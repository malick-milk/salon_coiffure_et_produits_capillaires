<?php

namespace App\Models;

use App\Enums\BookingSource;
use App\Enums\BookingStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Booking extends Model
{
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
}
