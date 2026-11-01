<?php

namespace App\Http\Resources;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use Illuminate\Http\Request;

/** Détail d'une commande : prix FIGÉS des lignes, jamais le coût (unit_cost reste interne) */
class OrderDetailResource extends OrderSummaryResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'items_count' => (int) $this->items->sum('quantity'),
            'items' => $this->items->map(fn ($i) => [
                'product_slug' => $i->product?->is_active ? $i->product->slug : null,
                'product_name' => $i->product_name,
                'unit_price' => $i->unit_price,
                'quantity' => $i->quantity,
                'line_total' => $i->line_total,
            ])->values(),
            'subtotal' => $this->subtotal,
            'discount_total' => $this->discount_total,
            'shipping_fee' => $this->shipping_fee,
            'delivery_zone' => $this->deliveryZone?->name,
            'shipping_address' => $this->shipping_address ? [
                'city' => $this->shipping_city,
                'district' => $this->shipping_district,
                'address_line' => $this->shipping_address,
                'landmark' => $this->shipping_landmark,
            ] : null,
            'invoice_available' => $this->payment_status === PaymentStatus::Paid, // RG-FAC-01
            'can_cancel' => $this->status === OrderStatus::Pending, // RG-COM-05
        ];
    }
}
