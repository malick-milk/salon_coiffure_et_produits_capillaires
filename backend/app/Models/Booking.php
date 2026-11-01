<?php

namespace App\Models;

use App\Enums\BookingSource;
use App\Enums\BookingStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Booking extends Model
{
    use LogsActivity;

    protected $fillable = [
        'reference', 'customer_id', 'service_id', 'stylist_id', 'source', 'status', 'starts_at', 'ends_at',
        'service_name', 'duration_minutes', 'price', 'customer_notes', 'admin_notes', 'cancellation_reason',
        'cancelled_by', 'confirmed_at', 'completed_at', 'cancelled_at',
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
            'price' => 'integer',
            'duration_minutes' => 'integer',
        ];
    }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function service(): BelongsTo { return $this->belongsTo(Service::class); }
    public function stylist(): BelongsTo { return $this->belongsTo(Stylist::class); }

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
