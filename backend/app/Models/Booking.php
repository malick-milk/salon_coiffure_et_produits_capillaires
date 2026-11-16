<?php

namespace App\Models;

use App\Enums\BookingSource;
use App\Enums\BookingStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Types des colonnes converties (casts) : déclarés pour l'analyse statique (Larastan).
 *
 * @property BookingStatus $status
 * @property BookingSource $source
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property Carbon|null $confirmed_at
 * @property Carbon|null $completed_at
 * @property Carbon|null $cancelled_at
 * @property Carbon|null $reminder_sent_at
 * @property Carbon|null $resserrage_reminded_at
 * @property Carbon|null $resserrage_snoozed_at
 * @property int $price
 * @property int $duration_minutes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Booking extends Model
{
    use LogsActivity;

    protected $fillable = [
        'reference', 'customer_id', 'service_id', 'stylist_id', 'source', 'status', 'starts_at', 'ends_at',
        'service_name', 'duration_minutes', 'price', 'customer_notes', 'admin_notes', 'cancellation_reason',
        'cancelled_by', 'confirmed_at', 'completed_at', 'cancelled_at', 'reminder_sent_at', 'resserrage_reminded_at', 'resserrage_snoozed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => BookingStatus::class,
            'source' => BookingSource::class,
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'reminder_sent_at' => 'datetime',
            'resserrage_reminded_at' => 'datetime',
            'resserrage_snoozed_at' => 'datetime',
            'price' => 'integer',
            'duration_minutes' => 'integer',
        ];
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** @return BelongsTo<Service, $this> */
    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    /** @return BelongsTo<Stylist, $this> */
    public function stylist(): BelongsTo
    {
        return $this->belongsTo(Stylist::class);
    }

    /** Réservations qui BLOQUENT un créneau (en attente ou confirmées) */
    public function scopeActive(Builder $query): void
    {
        $query->whereIn('status', [BookingStatus::Pending, BookingStatus::Confirmed]);
    }

    /** Journal d'audit (RG-SEC-01) : qui a modifié quoi, avec les valeurs avant et après */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('bookings')->logOnly(['status', 'starts_at', 'stylist_id', 'admin_notes'])->logOnlyDirty()->dontSubmitEmptyLogs();
    }
}
