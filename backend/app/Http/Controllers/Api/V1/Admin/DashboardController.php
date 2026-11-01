<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\BookingStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Tableau de bord du jour (EF-ERP-01). RBAC appliqué AUX DONNÉES : les montants (CA, marges)
 * ne sont renvoyés qu'aux utilisateurs ayant la permission analytics.view.
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $today = now()->startOfDay();
        $canSeeMoney = $request->user()->can('analytics.view');

        $revenue = function ($from, $to) {
            $products = (int) Order::query()->where('payment_status', PaymentStatus::Paid)->whereBetween('paid_at', [$from, $to])->sum('total');
            $services = (int) Booking::query()->where('status', BookingStatus::Completed)->whereBetween('starts_at', [$from, $to])->sum('price');

            return $products + $services;
        };

        $monthStart = now()->startOfMonth();
        $prevStart = now()->subMonthNoOverflow()->startOfMonth();
        $prevSamePoint = now()->subMonthNoOverflow(); // même nombre de jours écoulés : comparaison honnête

        $topProducts = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.payment_status', PaymentStatus::Paid->value)
            ->where('orders.paid_at', '>=', now()->subDays(30))
            ->groupBy('order_items.product_name')
            ->selectRaw('order_items.product_name AS name, SUM(order_items.quantity) AS units, SUM(order_items.line_total) AS revenue')
            ->selectRaw('IF(SUM(order_items.unit_cost IS NULL) > 0, NULL, ROUND(SUM(order_items.line_total - order_items.unit_cost * order_items.quantity))) AS margin')
            ->orderByDesc('units')->limit(5)->get();

        return response()->json(['data' => [
            'date' => $today->toDateString(),
            'revenue_today' => $canSeeMoney ? $revenue($today, now()) : null,
            'revenue_month' => $canSeeMoney ? $revenue($monthStart, now()) : null,
            'revenue_prev_month_same_period' => $canSeeMoney ? $revenue($prevStart, $prevSamePoint) : null,
            'orders_today' => Order::query()->where('placed_at', '>=', $today)->count(),
            'orders_to_process' => Order::query()->whereIn('status', [OrderStatus::Pending, OrderStatus::Confirmed, OrderStatus::Preparing])->count(),
            'bookings_today' => Booking::query()->whereDate('starts_at', $today)->whereNot('status', BookingStatus::Cancelled)->count(),
            'bookings_to_confirm' => Booking::query()->where('status', BookingStatus::Pending)->where('starts_at', '>=', now())->count(),
            'new_customers_month' => Customer::query()->where('created_at', '>=', $monthStart)->count(),
            'agenda' => Booking::query()->whereDate('starts_at', $today)->whereNot('status', BookingStatus::Cancelled)
                ->with(['customer', 'stylist'])->orderBy('starts_at')->get()
                ->map(fn (Booking $b) => ['reference' => $b->reference, 'time' => $b->starts_at->format('H:i'), 'service_name' => $b->service_name,
                    'customer_name' => $b->customer->fullName(), 'stylist_name' => $b->stylist->display_name, 'status' => $b->status->value]),
            'stock_alerts' => Product::query()->active()->whereColumn('stock_quantity', '<=', 'low_stock_threshold')->orderBy('stock_quantity')
                ->get(['id', 'name', 'unit_size', 'stock_quantity', 'low_stock_threshold'])
                ->map(fn (Product $p) => ['id' => $p->id, 'name' => $p->displayName(), 'stock' => $p->stock_quantity, 'threshold' => $p->low_stock_threshold]),
            'top_products' => $topProducts->map(fn ($r) => ['name' => $r->name, 'units' => (int) $r->units,
                'revenue' => $canSeeMoney ? (int) $r->revenue : null, 'margin' => $canSeeMoney && $r->margin !== null ? (int) $r->margin : null]),
            'recent_orders' => Order::query()->with('customer')->latest('placed_at')->limit(6)->get()
                ->map(fn (Order $o) => ['reference' => $o->reference, 'customer_name' => $o->customer->fullName(), 'channel' => $o->channel->value,
                    'fulfillment_method' => $o->fulfillment_method->value, 'status' => $o->status->value, 'payment_status' => $o->payment_status->value, 'total' => $o->total]),
        ]]);
    }
}
