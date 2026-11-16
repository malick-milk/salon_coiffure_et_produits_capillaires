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
use Illuminate\Support\Carbon;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Types des colonnes converties (casts) : déclarés pour l'analyse statique (Larastan).
 *
 * @property OrderChannel $channel
 * @property OrderStatus $status
 * @property PaymentStatus $payment_status
 * @property FulfillmentMethod $fulfillment_method
 * @property Carbon $placed_at
 * @property Carbon|null $confirmed_at
 * @property Carbon|null $shipped_at
 * @property Carbon|null $delivered_at
 * @property Carbon|null $picked_up_at
 * @property Carbon|null $paid_at
 * @property Carbon|null $cancelled_at
 * @property int $subtotal
 * @property int $discount_total
 * @property int $shipping_fee
 * @property int $total
 */
class Order extends Model
{
    use LogsActivity;

    protected $fillable = [
        'reference', 'customer_id', 'created_by', 'channel', 'status', 'payment_status', 'fulfillment_method', 'delivery_zone_id',
        'shipping_name', 'shipping_phone', 'shipping_city', 'shipping_district', 'shipping_address', 'shipping_landmark',
        'subtotal', 'discount_total', 'shipping_fee', 'tax_rate', 'tax_total', 'total', 'customer_notes', 'cancellation_reason',
        'placed_at', 'confirmed_at', 'shipped_at', 'delivered_at', 'paid_at', 'cancelled_at',
        'pickup_point_id', 'pickup_code', 'handover_token_hash', 'picked_up_at', 'consignment_statement_id',
    ];

    protected $hidden = ['handover_token_hash'];

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
            'picked_up_at' => 'datetime',
            'paid_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'subtotal' => 'integer',
            'discount_total' => 'integer',
            'shipping_fee' => 'integer',
            'total' => 'integer',
        ];
    }

    /**
     * Étape 14 : point de retrait partenaire choisi par la cliente
     *
     * @return BelongsTo<PickupPoint, $this>
     */
    public function pickupPoint(): BelongsTo
    {
        return $this->belongsTo(PickupPoint::class);
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** @return HasMany<OrderItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /** @return BelongsTo<DeliveryZone, $this> */
    public function deliveryZone(): BelongsTo
    {
        return $this->belongsTo(DeliveryZone::class);
    }

    /** @return MorphMany<Payment, $this> */
    public function payments(): MorphMany
    {
        return $this->morphMany(Payment::class, 'payable');
    }

    /** Journal d'audit (RG-SEC-01) : qui a modifié quoi, avec les valeurs avant et après */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('orders')->logOnly(['status', 'payment_status', 'cancellation_reason'])->logOnlyDirty()->dontSubmitEmptyLogs();
    }
}
