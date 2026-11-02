<?php

namespace App\Services\Analytics;

use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\DB;

/**
 * Le tableau de bord décisionnel (BI) : chaque méthode implémente UNE définition du dictionnaire
 * des KPI (docs/08_ANALYTICS.md), reprise des requêtes de référence database/analytics_queries.sql.
 *
 * Séries et totaux lisent les AGRÉGATS QUOTIDIENS (rapides) ; quelques indicateurs qui ont besoin
 * du détail (clients, heatmap, top produits) interrogent les tables métier, avec index.
 */
class AnalyticsService
{
    /** Au-delà, un agrégat du jour en cours est considéré comme périmé et recalculé */
    private const FRESHNESS_MINUTES = 5;

    public function __construct(private SnapshotBuilder $builder) {}

    public function overview(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $this->ensureSnapshots($from, $to);
        $days = $from->diffInDays($to) + 1;
        $prevTo = $from->subDay();
        $prevFrom = $prevTo->subDays($days - 1);
        $this->ensureSnapshots($prevFrom, $prevTo);

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'days' => $days, 'granularity' => $this->granularity($days)],
            'previous_period' => ['from' => $prevFrom->toDateString(), 'to' => $prevTo->toDateString()],
            'kpis' => $this->kpis($from, $to, $prevFrom, $prevTo),
            'series' => $this->series($from, $to),
            'top_products' => $this->topProducts($from, $to),
            'stock' => $this->stock($from, $to),
            'top_customers' => $this->topCustomers($from, $to),
            'booking_heatmap' => $this->bookingHeatmap($from, $to),
            'payment_methods' => $this->paymentMethods($from, $to),
            'data_quality' => $this->dataQuality($from, $to),
            'computed_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Filet de sécurité : le job nocturne calcule les agrégats, mais si un jour manque
     * (serveur éteint, première installation), on le calcule à la demande. Le jour en cours
     * est recalculé s'il date de plus de 5 minutes (données « presque temps réel »).
     */
    public function ensureSnapshots(CarbonImmutable $from, CarbonImmutable $to): void
    {
        $today = CarbonImmutable::today();
        $known = DB::table('daily_sales_snapshots')->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->where(fn ($q) => $q->where('date', '<', $today->toDateString())->orWhere('computed_at', '>=', now()->subMinutes(self::FRESHNESS_MINUTES)))
            ->pluck('date')->map(fn ($d) => (string) $d)->flip();
        $missing = collect(CarbonPeriod::create($from, $to))->map(fn ($d) => $d->toDateString())->reject(fn ($d) => isset($known[$d]));
        if ($missing->isNotEmpty()) {
            $this->builder->build(CarbonImmutable::parse($missing->first()), CarbonImmutable::parse($missing->last()));
        }
    }

    private function granularity(int $days): string
    {
        return match (true) {
            $days <= 62 => 'day', $days <= 190 => 'week', default => 'month'
        };
    }

    private function totals(CarbonImmutable $from, CarbonImmutable $to): object
    {
        return DB::table('daily_sales_snapshots')->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('COALESCE(SUM(products_revenue),0) products_revenue, COALESCE(SUM(services_revenue),0) services_revenue,
                COALESCE(SUM(orders_count),0) orders, COALESCE(SUM(items_sold),0) items, COALESCE(SUM(costed_revenue),0) costed_revenue,
                COALESCE(SUM(gross_margin),0) gross_margin, COALESCE(SUM(bookings_count),0) bookings,
                COALESCE(SUM(bookings_completed),0) completed, COALESCE(SUM(bookings_no_show),0) no_show,
                COALESCE(SUM(new_customers),0) new_customers')->first();
    }

    /** Q06 : clients actifs (≥ 1 achat payé ou prestation terminée) et part de ceux venus au moins 2 fois */
    private function returning(CarbonImmutable $from, CarbonImmutable $to): array
    {
        [$s, $e] = $this->bounds($from, $to);
        $row = DB::selectOne("SELECT COUNT(*) active, COALESCE(SUM(visits >= 2), 0) returning FROM (
                SELECT customer_id, COUNT(*) visits FROM (
                    SELECT customer_id FROM orders WHERE payment_status = 'paid' AND paid_at >= ? AND paid_at < ?
                    UNION ALL SELECT customer_id FROM bookings WHERE status = 'completed' AND starts_at >= ? AND starts_at < ?
                ) v GROUP BY customer_id) per_customer", [$s, $e, $s, $e]);

        return ['active' => (int) $row->active, 'returning' => (int) $row->returning];
    }

    private function kpis(CarbonImmutable $from, CarbonImmutable $to, CarbonImmutable $prevFrom, CarbonImmutable $prevTo): array
    {
        $build = function (object $t, array $r) {
            $pastBookings = $t->completed + $t->no_show;

            return [
                'revenue' => $t->products_revenue + $t->services_revenue,
                'products_revenue' => (int) $t->products_revenue,
                'services_revenue' => (int) $t->services_revenue,
                'orders' => (int) $t->orders,
                'items_sold' => (int) $t->items,
                'average_basket' => $t->orders ? (int) round($t->products_revenue / $t->orders) : null,                 // Q03
                'gross_margin' => $t->costed_revenue ? (int) $t->gross_margin : null,
                'margin_rate' => $t->costed_revenue ? round(100 * $t->gross_margin / $t->costed_revenue, 1) : null,
                'bookings' => (int) $t->bookings,
                'bookings_completed' => (int) $t->completed,
                'no_show_rate' => $pastBookings ? round(100 * $t->no_show / $pastBookings, 1) : null,                  // Q09
                'new_customers' => (int) $t->new_customers,
                'active_customers' => $r['active'],
                'returning_rate' => $r['active'] ? round(100 * $r['returning'] / $r['active'], 1) : null,              // Q06
            ];
        };

        return [
            'current' => $build($this->totals($from, $to), $this->returning($from, $to)),
            'previous' => $build($this->totals($prevFrom, $prevTo), $this->returning($prevFrom, $prevTo)),
        ];
    }

    /** Q01 : CA par jour, semaine ISO ou mois ; les périodes sans vente valent 0 (grâce au calendrier) */
    private function series(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $bucket = match ($this->granularity($from->diffInDays($to) + 1)) {
            'day' => 'c.date',
            'week' => 'DATE_SUB(c.date, INTERVAL (c.day_of_week - 1) DAY)', // lundi de la semaine
            default => "DATE_FORMAT(c.date, '%Y-%m-01')",
        };

        return collect(DB::select("SELECT {$bucket} AS bucket, SUM(s.products_revenue) products, SUM(s.services_revenue) services,
                SUM(s.orders_count) orders, SUM(s.bookings_completed) bookings
            FROM calendar_dates c JOIN daily_sales_snapshots s ON s.date = c.date
            WHERE c.date BETWEEN ? AND ? GROUP BY bucket ORDER BY bucket", [$from->toDateString(), $to->toDateString()]))
            ->map(fn ($r) => ['date' => (string) $r->bucket, 'products' => (int) $r->products, 'services' => (int) $r->services,
                'orders' => (int) $r->orders, 'bookings' => (int) $r->bookings])->all();
    }

    /** Q04 : produits les plus vendus (commandes payées), marge NULL si un coût est inconnu */
    private function topProducts(CarbonImmutable $from, CarbonImmutable $to): array
    {
        [$s, $e] = $this->bounds($from, $to);

        return collect(DB::select('SELECT oi.product_id, oi.product_name, SUM(oi.quantity) units, SUM(oi.line_total) revenue,
                IF(SUM(oi.unit_cost IS NULL) > 0, NULL, ROUND(SUM(oi.line_total - oi.unit_cost * oi.quantity))) margin
            FROM order_items oi JOIN orders o ON o.id = oi.order_id
            WHERE o.payment_status = \'paid\' AND o.paid_at >= ? AND o.paid_at < ?
            GROUP BY oi.product_id, oi.product_name ORDER BY revenue DESC LIMIT 10', [$s, $e]))
            ->map(fn ($r) => ['product_id' => (int) $r->product_id, 'name' => $r->product_name, 'units' => (int) $r->units,
                'revenue' => (int) $r->revenue, 'margin' => $r->margin === null ? null : (int) $r->margin,
                'margin_rate' => $r->margin === null || ! $r->revenue ? null : round(100 * $r->margin / $r->revenue, 1)])->all();
    }

    /**
     * Q10 + Q11 + Q12 : rotation, couverture et prévision de rupture, produits dormants.
     * - Rotation = unités vendues ÷ stock moyen de la période (moyenne des stocks de fin de journée).
     * - Couverture = stock actuel ÷ demande moyenne par jour sur les 90 derniers jours.
     */
    private function stock(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $today = CarbonImmutable::today();
        $this->ensureSnapshots($today->subDays(89), $today);
        $period = DB::table('daily_product_stats')->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->groupBy('product_id')->selectRaw('product_id, SUM(quantity_sold) sold, AVG(stock_end) avg_stock')->get()->keyBy('product_id');
        $demand90 = DB::table('daily_product_stats')->whereBetween('date', [$today->subDays(89)->toDateString(), $today->toDateString()])
            ->groupBy('product_id')->selectRaw('product_id, SUM(quantity_sold) / 90 per_day')->pluck('per_day', 'product_id');

        return DB::table('products')->whereNull('deleted_at')->where('is_active', true)->orderBy('name')->orderBy('unit_size')
            ->get(['id', 'name', 'unit_size', 'stock_quantity', 'low_stock_threshold', 'cost_price'])
            ->map(function ($p) use ($period, $demand90, $today) {
                $perDay = (float) ($demand90[$p->id] ?? 0);
                $sold = (int) ($period[$p->id]->sold ?? 0);
                $avgStock = (float) ($period[$p->id]->avg_stock ?? 0);
                $cover = $perDay > 0 ? (int) floor($p->stock_quantity / $perDay) : null;
                $status = match (true) {
                    $p->stock_quantity === 0 => 'out_of_stock',
                    $p->stock_quantity <= $p->low_stock_threshold => 'below_threshold',
                    $cover !== null && $cover < 14 => 'cover_under_14_days',
                    $p->stock_quantity > 0 && $sold <= 2 => 'slow_moving',
                    default => 'ok',
                };

                return [
                    'product_id' => $p->id, 'name' => trim($p->name.' '.$p->unit_size), 'stock' => $p->stock_quantity,
                    'threshold' => $p->low_stock_threshold, 'units_sold' => $sold,
                    'turnover' => $avgStock > 0 ? round($sold / $avgStock, 2) : null,
                    'avg_daily_demand' => round($perDay, 2), 'days_of_cover' => $cover,
                    'stockout_date' => $cover !== null && $p->stock_quantity > 0 ? $today->addDays($cover)->toDateString() : null,
                    'immobilized_value' => $p->cost_price === null ? null : (int) round($p->stock_quantity * (float) $p->cost_price),
                    'status' => $status,
                ];
            })->sortBy(fn ($r) => [array_search($r['status'], ['out_of_stock', 'below_threshold', 'cover_under_14_days', 'slow_moving', 'ok'], true), $r['days_of_cover'] ?? PHP_INT_MAX])
            ->values()->all();
    }

    /** Q07 : meilleurs clients de la période, avec leur valeur vie client (CLV historique) et leur récence */
    private function topCustomers(CarbonImmutable $from, CarbonImmutable $to): array
    {
        [$s, $e] = $this->bounds($from, $to);

        return collect(DB::select("WITH spending AS (
                SELECT customer_id, total amount, paid_at at FROM orders WHERE payment_status = 'paid'
                UNION ALL SELECT customer_id, price, starts_at FROM bookings WHERE status = 'completed'
            )
            SELECT c.id, CONCAT(c.first_name, ' ', c.last_name) name, c.customer_type type,
                SUM(CASE WHEN s.at >= ? AND s.at < ? THEN s.amount ELSE 0 END) period_spent,
                SUM(s.at >= ? AND s.at < ?) period_visits,
                SUM(s.amount) lifetime_value, COUNT(*) lifetime_visits, MAX(s.at) last_visit
            FROM spending s JOIN customers c ON c.id = s.customer_id
            GROUP BY c.id, c.first_name, c.last_name, c.customer_type
            HAVING period_spent > 0 ORDER BY period_spent DESC LIMIT 10", [$s, $e, $s, $e]))
            ->map(fn ($r) => ['customer_id' => (int) $r->id, 'name' => $r->name, 'type' => $r->type,
                'period_spent' => (int) $r->period_spent, 'period_visits' => (int) $r->period_visits,
                'lifetime_value' => (int) $r->lifetime_value, 'lifetime_visits' => (int) $r->lifetime_visits,
                'days_since_last_visit' => (int) CarbonImmutable::parse($r->last_visit)->startOfDay()->diffInDays(CarbonImmutable::today(), false)])->all();
    }

    /** Q08 : demande de rendez-vous par jour de la semaine et par heure (hors annulations) */
    private function bookingHeatmap(CarbonImmutable $from, CarbonImmutable $to): array
    {
        [$s, $e] = $this->bounds($from, $to);

        return collect(DB::select("SELECT WEEKDAY(starts_at) + 1 dow, HOUR(starts_at) hour, COUNT(*) n FROM bookings
            WHERE status <> 'cancelled' AND starts_at >= ? AND starts_at < ? GROUP BY dow, hour ORDER BY dow, hour", [$s, $e]))
            ->map(fn ($r) => ['day_of_week' => (int) $r->dow, 'hour' => (int) $r->hour, 'bookings' => (int) $r->n])->all();
    }

    private function paymentMethods(CarbonImmutable $from, CarbonImmutable $to): array
    {
        [$s, $e] = $this->bounds($from, $to);

        return collect(DB::select("SELECT method, COUNT(*) n, SUM(amount) amount FROM payments
            WHERE status = 'succeeded' AND paid_at >= ? AND paid_at < ? GROUP BY method ORDER BY amount DESC", [$s, $e]))
            ->map(fn ($r) => ['method' => $r->method, 'count' => (int) $r->n, 'amount' => (int) $r->amount])->all();
    }

    /** Qualité des données : un tableau de bord honnête dit ce qu'il ne sait pas */
    private function dataQuality(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $t = $this->totals($from, $to);
        $linesRevenue = (int) DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.payment_status', 'paid')->whereBetween('orders.paid_at', $this->bounds($from, $to, inclusiveEnd: true))->sum('order_items.line_total');

        return [
            'products_without_cost' => DB::table('products')->whereNull('deleted_at')->where('is_active', true)->whereNull('cost_price')
                ->orderBy('name')->get(['name', 'unit_size'])->map(fn ($p) => trim($p->name.' '.$p->unit_size))->all(),
            'costed_revenue_share' => $linesRevenue ? round(100 * $t->costed_revenue / $linesRevenue, 1) : null,
        ];
    }

    /** [début inclus, fin EXCLUSIVE] : « < lendemain minuit » attrape toute la dernière journée, index compris */
    private function bounds(CarbonImmutable $from, CarbonImmutable $to, bool $inclusiveEnd = false): array
    {
        $end = $to->startOfDay()->addDay();

        return [$from->startOfDay()->toDateTimeString(), ($inclusiveEnd ? $end->subSecond() : $end)->toDateTimeString()];
    }
}
