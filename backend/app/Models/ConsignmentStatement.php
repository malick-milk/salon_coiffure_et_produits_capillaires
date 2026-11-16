<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Relevé mensuel d'un point de retrait : comptage, ventes, commission, montant à verser avant le 5
 *
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property int $counter_sales_total
 * @property int $online_sales_total
 * @property int $sales_total
 * @property string $commission_rate
 * @property int $commission_gross
 * @property int $damaged_value
 * @property int $commission_net
 * @property int $amount_due
 * @property int|null $declared_sold
 * @property Carbon $due_date
 * @property Carbon|null $paid_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class ConsignmentStatement extends Model
{
    use LogsActivity;

    protected $fillable = [
        'number', 'pickup_point_id', 'period', 'counter_sales_total', 'online_sales_total', 'sales_total', 'commission_rate',
        'commission_gross', 'damaged_value', 'commission_net', 'amount_due', 'due_date', 'declared_sold', 'gap_note',
        'counter_order_id', 'paid_at', 'payment_method', 'validated_by',
    ];

    protected function casts(): array
    {
        return [
            'counter_sales_total' => 'integer', 'online_sales_total' => 'integer', 'sales_total' => 'integer',
            'commission_rate' => 'decimal:2', 'commission_gross' => 'integer', 'damaged_value' => 'integer',
            'commission_net' => 'integer', 'amount_due' => 'integer', 'declared_sold' => 'integer',
            'due_date' => 'date', 'paid_at' => 'datetime',
        ];
    }

    /** @return HasMany<ConsignmentStatementItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(ConsignmentStatementItem::class);
    }

    /** @return BelongsTo<PickupPoint, $this> */
    public function pickupPoint(): BelongsTo
    {
        return $this->belongsTo(PickupPoint::class);
    }

    /** @return HasMany<Order, $this> */
    public function onlineOrders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /** « paid », « due » (avant le 5) ou « overdue » (en retard) : calculé, donc toujours à jour */
    public function paymentState(): string
    {
        if ($this->paid_at) {
            return 'paid';
        }

        return now()->startOfDay()->greaterThan($this->due_date) ? 'overdue' : 'due';
    }

    public function soldQuantity(): int
    {
        return (int) $this->items->sum(fn ($i) => $i->counter_sold_qty + $i->online_qty);
    }

    public function damagedQuantity(): int
    {
        return (int) $this->items->sum('damaged_qty');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('pickup_points')->logOnly(['amount_due', 'paid_at', 'payment_method', 'gap_note'])->logOnlyDirty()->dontSubmitEmptyLogs();
    }
}
