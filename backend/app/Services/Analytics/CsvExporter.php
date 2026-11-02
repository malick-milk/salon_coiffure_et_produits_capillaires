<?php

namespace App\Services\Analytics;

use App\Models\Order;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Exports CSV pour l'analyse (Excel, Power BI, pandas) et la préparation du ML.
 *
 * Sécurité et vie privée :
 * - MINIMISATION : aucun nom, téléphone ni adresse ; le client est un identifiant numérique
 *   (pseudonyme). Un analyste n'a pas besoin de savoir QUI, seulement COMMENT on achète.
 * - INJECTION DE FORMULE (OWASP « CSV Injection ») : une cellule texte commençant par = + - @
 *   serait exécutée comme une formule par Excel. On la préfixe d'une apostrophe.
 * - Flux (streaming) : les lignes sont écrites au fur et à mesure, sans tout charger en mémoire.
 */
class CsvExporter
{
    public const DATASETS = ['daily_sales', 'product_daily', 'order_lines'];

    public function __construct(private AnalyticsService $analytics) {}

    public function download(string $dataset, CarbonImmutable $from, CarbonImmutable $to): StreamedResponse
    {
        $this->analytics->ensureSnapshots($from, $to);
        [$header, $rows] = match ($dataset) {
            'daily_sales' => $this->dailySales($from, $to),
            'product_daily' => $this->productDaily($from, $to),
            'order_lines' => $this->orderLines($from, $to),
        };
        $filename = "dabo-hair_{$dataset}_{$from->toDateString()}_{$to->toDateString()}.csv";

        return response()->streamDownload(function () use ($header, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM UTF-8 : Excel affiche correctement les accents
            fputcsv($out, $header, ';', escape: '');
            foreach ($rows as $row) {
                fputcsv($out, array_map(self::sanitize(...), (array) $row), ';', escape: '');
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8', 'Cache-Control' => 'no-store']);
    }

    /** Neutralise une formule ; les NOMBRES (même négatifs) restent des nombres */
    public static function sanitize(mixed $value): mixed
    {
        if (is_string($value) && $value !== '' && ! is_numeric($value) && in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true)) {
            return "'".$value;
        }

        return $value;
    }

    /** Une ligne par jour, avec les attributs du calendrier : prêt pour une série temporelle (Prophet, scikit-learn) */
    private function dailySales(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $cols = ['date', 'year', 'month', 'iso_week', 'day_of_week', 'is_weekend', 'orders_count', 'items_sold', 'products_revenue',
            'costed_revenue', 'products_cost', 'gross_margin', 'bookings_count', 'bookings_completed', 'bookings_no_show', 'services_revenue', 'new_customers'];

        return [$cols, DB::table('daily_sales_snapshots as s')->join('calendar_dates as c', 'c.date', '=', 's.date')
            ->whereBetween('s.date', [$from->toDateString(), $to->toDateString()])->orderBy('s.date')
            ->select(array_map(fn ($c) => in_array($c, ['year', 'month', 'iso_week', 'day_of_week', 'is_weekend']) ? "c.$c" : "s.$c", $cols))->cursor()];
    }

    private function productDaily(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return [['date', 'day_of_week', 'is_weekend', 'product_id', 'sku', 'product', 'quantity_sold', 'revenue', 'cost', 'stock_end'],
            DB::table('daily_product_stats as d')->join('calendar_dates as c', 'c.date', '=', 'd.date')->join('products as p', 'p.id', '=', 'd.product_id')
                ->whereBetween('d.date', [$from->toDateString(), $to->toDateString()])->orderBy('d.date')->orderBy('d.product_id')
                ->selectRaw("d.date, c.day_of_week, c.is_weekend, d.product_id, p.sku, TRIM(CONCAT(p.name, ' ', COALESCE(p.unit_size, ''))) product, d.quantity_sold, d.revenue, d.cost, d.stock_end")
                ->cursor()];
    }

    /** Le niveau le plus fin : une ligne par article commandé (commandes passées sur la période) */
    private function orderLines(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return [['order_reference', 'placed_at', 'paid_at', 'channel', 'fulfillment_method', 'status', 'payment_status', 'payment_method',
            'customer_id', 'customer_type', 'sku', 'product', 'quantity', 'unit_price', 'unit_cost', 'line_total'],
            DB::table('order_items as oi')->join('orders as o', 'o.id', '=', 'oi.order_id')->join('customers as c', 'c.id', '=', 'o.customer_id')
                ->leftJoin('payments as pay', fn ($j) => $j->on('pay.payable_id', '=', 'o.id')->where('pay.payable_type', Order::class)->where('pay.status', 'succeeded'))
                ->where('o.placed_at', '>=', $from->startOfDay())->where('o.placed_at', '<', $to->startOfDay()->addDay())
                ->orderBy('o.placed_at')->orderBy('oi.id')
                ->select('o.reference', 'o.placed_at', 'o.paid_at', 'o.channel', 'o.fulfillment_method', 'o.status', 'o.payment_status', 'pay.method',
                    'o.customer_id', 'c.customer_type', 'oi.sku', 'oi.product_name', 'oi.quantity', 'oi.unit_price', 'oi.unit_cost', 'oi.line_total')
                ->cursor()];
    }
}
