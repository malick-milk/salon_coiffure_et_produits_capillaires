<?php

namespace App\Http\Resources;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Order */
class OrderSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'reference' => $this->reference,
            'status' => $this->status->value,
            'payment_status' => $this->payment_status->value,
            'fulfillment_method' => $this->fulfillment_method->value,
            'total' => $this->total,
            'items_count' => (int) ($this->items_count ?? $this->items->sum('quantity')),
            'placed_at' => $this->placed_at->format('Y-m-d\TH:i:s'),
        ];
    }
}
