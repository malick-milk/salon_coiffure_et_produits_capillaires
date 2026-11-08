<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ChangeOrderStatusAction;
use App\Actions\Admin\RecordPaymentAction;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderDetailResource;
use App\Models\Invoice;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrderAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $f = $request->validate([
            'status' => ['nullable', Rule::enum(OrderStatus::class)],
            'payment_status' => ['nullable', 'in:unpaid,paid,refunded'],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $page = Order::query()->with('customer')->withSum('items as items_count', 'quantity')
            ->when($f['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($f['payment_status'] ?? null, fn ($q, $s) => $q->where('payment_status', $s))
            ->when($f['search'] ?? null, function ($q, $s) {
                $term = '%'.addcslashes($s, '%_\\').'%';
                $q->where(fn ($w) => $w->where('reference', 'like', $term)->orWhereHas('customer', fn ($c) => $c->where('first_name', 'like', $term)->orWhere('last_name', 'like', $term)->orWhere('phone', 'like', $term)));
            })
            ->latest('placed_at')->paginate(20);

        return response()->json([
            'data' => $page->getCollection()->map(fn (Order $o) => [
                'reference' => $o->reference, 'customer_name' => $o->customer->fullName(), 'customer_phone' => $o->customer->phone,
                'customer_type' => $o->customer->customer_type->value, 'channel' => $o->channel->value, 'fulfillment_method' => $o->fulfillment_method->value,
                'status' => $o->status->value, 'payment_status' => $o->payment_status->value, 'items_count' => (int) $o->items_count,
                'total' => $o->total, 'placed_at' => $o->placed_at->format('Y-m-d\TH:i:s'),
            ]),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    public function show(string $reference): JsonResponse
    {
        return response()->json(['data' => $this->detail(Order::query()->where('reference', $reference)->firstOrFail())]);
    }

    public function updateStatus(Request $request, string $reference, ChangeOrderStatusAction $change): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::enum(OrderStatus::class)], 'reason' => ['nullable', 'string', 'max:255']]);
        $order = Order::query()->where('reference', $reference)->firstOrFail();
        $change->execute($order, OrderStatus::from($data['status']), $request->user(), $data['reason'] ?? null);

        return response()->json(['data' => $this->detail($order->fresh())]);
    }

    public function recordPayment(Request $request, string $reference, RecordPaymentAction $record): JsonResponse
    {
        $data = $request->validate(['method' => ['required', Rule::enum(PaymentMethod::class)], 'provider_reference' => ['nullable', 'string', 'max:191']]);
        $order = Order::query()->where('reference', $reference)->firstOrFail();
        $record->execute($order, PaymentMethod::from($data['method']), $request->user(), $data['provider_reference'] ?? null);

        return response()->json(['data' => $this->detail($order->fresh())]);
    }

    /** Détail ERP : le détail client + qui est le client, paiements, facture, transitions possibles */
    private function detail(Order $order): array
    {
        $order->load(['items.product', 'deliveryZone', 'customer', 'payments', 'pickupPoint']);
        $invoice = Invoice::query()->where('order_id', $order->id)->where('type', 'invoice')->first();

        return [
            ...(new OrderDetailResource($order))->resolve(),
            'customer' => ['name' => $order->customer->fullName(), 'phone' => $order->customer->phone, 'email' => $order->customer->email, 'type' => $order->customer->customer_type->value],
            'channel' => $order->channel->value,
            'customer_notes' => $order->customer_notes,
            'cancellation_reason' => $order->cancellation_reason,
            'picked_up_at' => $order->picked_up_at?->format('Y-m-d\TH:i:s'), // étape 14 : remise confirmée par le partenaire
            'payments' => $order->payments->map(fn ($p) => ['method' => $p->method->value, 'amount' => $p->amount, 'paid_at' => $p->paid_at?->format('Y-m-d\TH:i:s'), 'provider_reference' => $p->provider_reference]),
            'invoice_number' => $invoice?->number,
            'allowed_transitions' => array_map(fn (OrderStatus $s) => $s->value, $order->status->transitions($order->fulfillment_method)),
        ];
    }
}
