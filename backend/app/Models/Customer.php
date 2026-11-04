<?php

namespace App\Models;

use App\Enums\CustomerType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Client MÉTIER : inscrit (user_id) ou invité (user_id NULL). DATABASE.md §3.1 */
class Customer extends Model
{
    use SoftDeletes;

    protected $fillable = ['user_id', 'customer_type', 'first_name', 'last_name', 'phone', 'email', 'marketing_consent', 'notes'];

    protected function casts(): array
    {
        return ['customer_type' => CustomerType::class, 'marketing_consent' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(Address::class);
    }

    public function fullName(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }
}
