<?php

namespace App\Models;

use App\Enums\FulfillmentMethod;
use App\Enums\OrderChannel;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Order extends Model
{
    protected $fillable = [
        'reference', 'customer_id', 'created_by', 'channel', 'status', 'payment_status', 'fulfillment_method', 'delivery_zone_id',
        'shipping_name', 'shipping_phone', 'shipping_city', 'shipping_district', 'shipping_address', 'shipping_landmark',
        'subtotal', 'discount_total', 'shipping_fee', 'tax_rate', 'tax_total', 'total', 'customer_notes', 'cancellation_reason',
        'placed_at', 'confirmed_at', 'shipped_at', 'delivered_at', 'paid_at', 'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'channel' => OrderChannel::class,
            'status' => OrderStatus::class,
            'payment_status' => PaymentStatus::class,
            'fulfillment_method' => FulfillmentMethod::class,
            'placed_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'shipped_at' => 'datetime',
            'delivered_at' => 'datetime',
            'paid_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'subtotal' => 'integer',
            'discount_total' => 'integer',
            'shipping_fee' => 'integer',
            'total' => 'integer',
        ];
    }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function items(): HasMany { return $this->hasMany(OrderItem::class); }
    public function deliveryZone(): BelongsTo { return $this->belongsTo(DeliveryZone::class); }
    public function payments(): MorphMany { return $this->morphMany(Payment::class, 'payable'); }
}
