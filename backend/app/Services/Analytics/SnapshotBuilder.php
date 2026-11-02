<?php

namespace App\Services\Analytics;

use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\DB;

/**
 * Construit les AGRÉGATS QUOTIDIENS (ADR-008) : un mini entrepôt de données.
 *
 * Les tables métier (orders, bookings…) sont faites pour ÉCRIRE vite et sans erreur (OLTP).
 * Les tables d'agrégats sont faites pour LIRE vite des mois d'historique (OLAP) :
 * une ligne par jour, déjà additionnée. Le tableau de bord et les futurs modèles de ML les lisent.
 *
 * Deux points de vue, volontairement distincts :
 * - daily_sales_snapshots = l'ENCAISSÉ : commandes payées (date de paiement), prestations terminées ;
 * - daily_product_stats   = la DEMANDE : unités sorties du stock pour vente (date de commande),
 *   annulations déduites. C'est elle qui sert à prévoir les ruptures.
 *
 * Idempotent : reconstruire un jour donne toujours le même résultat (upsert).
 */
class SnapshotBuilder
{
    /** @return int nombre de jours (re)calculés */
    public function build(CarbonImmutable $from, CarbonImmutable $to): int
    {
        $from = $from->startOfDay();
        $to = $to->startOfDay();
        $start = $from->toDateTimeString();
        $end = $to->addDay()->toDateTimeString(); // borne EXCLUSIVE : < lendemain minuit
        $days = collect(CarbonPeriod::create($from, $to))->map(fn ($d) => $d->toDateString());

        DB::transaction(function () use ($start, $end, $days, $from) {
            $this->ensureCalendar($days->all());
            $this->buildSales($start, $end, $days->all());
            $this->buildProducts($start, $end, $days->all(), $from);
        });

        return $days->count();
    }

    /** Dimension calendrier : une ligne par date, avec ses attributs (mois, semaine ISO, week-end…) */
    public function ensureCalendar(array $days): void
    {
        $rows = array_map(function (string $day) {
            $d = CarbonImmutable::parse($day);

            return [
                'date' => $day, 'year' => $d->year, 'quarter' => $d->quarter, 'month' => $d->month,
                'iso_week' => $d->isoWeek, 'day_of_month' => $d->day, 'day_of_week' => $d->dayOfWeekIso, 'is_weekend' => $d->isWeekend(),
            ];
        }, $days);
        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('calendar_dates')->insertOrIgnore($chunk);
        }
    }

    private function buildSales(string $start, string $end, array $days): void
    {
        $byDay = fn (string $sql, array $bindings) => collect(DB::select($sql, $bindings))->keyBy('d');

        $orders = $byDay("SELECT DATE(paid_at) d, COUNT(*) n, SUM(total) revenue FROM orders
            WHERE payment_status = 'paid' AND paid_at >= ? AND paid_at < ? GROUP BY d", [$start, $end]);

        // Lignes des commandes payées : unités, et marge UNIQUEMENT sur les lignes au coût connu
        $lines = $byDay("SELECT DATE(o.paid_at) d, SUM(oi.quantity) items,
                SUM(CASE WHEN oi.unit_cost IS NOT NULL THEN oi.line_total ELSE 0 END) costed_revenue,
                SUM(CASE WHEN oi.unit_cost IS NOT NULL THEN oi.unit_cost * oi.quantity ELSE 0 END) cost
            FROM order_items oi JOIN orders o ON o.id = oi.order_id
            WHERE o.payment_status = 'paid' AND o.paid_at >= ? AND o.paid_at < ? GROUP BY d", [$start, $end]);

        $bookings = $byDay("SELECT DATE(starts_at) d, SUM(status <> 'cancelled') n, SUM(status = 'completed') completed,
                SUM(status = 'no_show') no_show, SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END) revenue
            FROM bookings WHERE starts_at >= ? AND starts_at < ? GROUP BY d", [$start, $end]);

        // Nouveau client = date de sa PREMIÈRE activité (commande non annulée ou réservation non annulée), requête Q05
        $newCustomers = $byDay("SELECT DATE(first_at) d, COUNT(*) n FROM (
                SELECT customer_id, MIN(at) first_at FROM (
                    SELECT customer_id, placed_at at FROM orders WHERE status <> 'cancelled'
                    UNION ALL SELECT customer_id, starts_at FROM bookings WHERE status <> 'cancelled'
                ) activity GROUP BY customer_id
            ) firsts WHERE first_at >= ? AND first_at < ? GROUP BY d", [$start, $end]);

        $now = now();
        $rows = array_map(function (string $day) use ($orders, $lines, $bookings, $newCustomers, $now) {
            $l = $lines[$day] ?? null;
            $costedRevenue = (int) ($l->costed_revenue ?? 0);
            $cost = (int) round((float) ($l->cost ?? 0));

            return [
                'date' => $day,
                'orders_count' => (int) ($orders[$day]->n ?? 0),
                'items_sold' => (int) ($l->items ?? 0),
                'products_revenue' => (int) ($orders[$day]->revenue ?? 0),
                'costed_revenue' => $costedRevenue,
                'products_cost' => $cost,
                'gross_margin' => $costedRevenue - $cost,
                'bookings_count' => (int) ($bookings[$day]->n ?? 0),
                'bookings_completed' => (int) ($bookings[$day]->completed ?? 0),
                'bookings_no_show' => (int) ($bookings[$day]->no_show ?? 0),
                'services_revenue' => (int) ($bookings[$day]->revenue ?? 0),
                'new_customers' => (int) ($newCustomers[$day]->n ?? 0),
                'computed_at' => $now,
            ];
        }, $days);

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('daily_sales_snapshots')->upsert($chunk, ['date']);
        }
    }

    private function buildProducts(string $start, string $end, array $days, CarbonImmutable $from): void
    {
        $products = DB::table('products')->whereNull('deleted_at')->pluck('id');

        // Stock au début de la période, reconstruit depuis le grand livre (la seule source de vérité)
        $opening = DB::table('stock_movements')->where('created_at', '<', $start)
            ->groupBy('product_id')->pluck(DB::raw('SUM(quantity)'), 'product_id');

        $net = collect(DB::select('SELECT product_id, DATE(created_at) d, SUM(quantity) q FROM stock_movements
            WHERE created_at >= ? AND created_at < ? GROUP BY product_id, d', [$start, $end]))
            ->groupBy('product_id')->map(fn ($rows) => $rows->pluck('q', 'd'));

        // Demande : sorties pour vente moins annulations (en positif)
        $demand = collect(DB::select("SELECT product_id, DATE(created_at) d, -SUM(quantity) q FROM stock_movements
            WHERE type IN ('sale', 'sale_cancellation') AND created_at >= ? AND created_at < ? GROUP BY product_id, d", [$start, $end]))
            ->groupBy('product_id')->map(fn ($rows) => $rows->pluck('q', 'd'));

        // Valeur de cette demande (commandes non annulées, date de commande) ; coût NULL si un coût est inconnu
        $values = collect(DB::select("SELECT oi.product_id, DATE(o.placed_at) d, SUM(oi.line_total) revenue,
                IF(SUM(oi.unit_cost IS NULL) > 0, NULL, SUM(oi.unit_cost * oi.quantity)) cost
            FROM order_items oi JOIN orders o ON o.id = oi.order_id
            WHERE o.status <> 'cancelled' AND o.placed_at >= ? AND o.placed_at < ? GROUP BY oi.product_id, d", [$start, $end]))
            ->groupBy('product_id')->map(fn ($rows) => $rows->keyBy('d'));

        $now = now();
        $rows = [];
        foreach ($products as $id) {
            $stock = (int) ($opening[$id] ?? 0);
            foreach ($days as $day) {
                $stock += (int) ($net[$id][$day] ?? 0);
                $value = $values[$id][$day] ?? null;
                $rows[] = [
                    'date' => $day, 'product_id' => $id,
                    'quantity_sold' => max(0, (int) ($demand[$id][$day] ?? 0)),
                    'revenue' => (int) ($value->revenue ?? 0),
                    'cost' => $value === null ? 0 : ($value->cost === null ? null : (int) round((float) $value->cost)),
                    'stock_end' => max(0, $stock),
                    'computed_at' => $now,
                ];
            }
        }
        foreach (array_chunk($rows, 1000) as $chunk) {
            DB::table('daily_product_stats')->upsert($chunk, ['date', 'product_id']);
        }
    }
}
