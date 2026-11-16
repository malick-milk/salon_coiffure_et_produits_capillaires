<?php

namespace App\Models;

use App\Enums\CustomerType;
use App\Support\Phone;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;

/** Client MÉTIER : inscrit (user_id) ou invité (user_id NULL). DATABASE.md §3.1 */
class Customer extends Model
{
    use Notifiable, SoftDeletes;

    protected $fillable = ['user_id', 'customer_type', 'first_name', 'last_name', 'phone', 'email', 'marketing_consent', 'resserrage_opt_out', 'notes'];

    protected function casts(): array
    {
        return ['customer_type' => CustomerType::class, 'marketing_consent' => 'boolean', 'resserrage_opt_out' => 'boolean'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<Order, $this> */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /** @return HasMany<Booking, $this> */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    /** @return HasMany<Address, $this> */
    public function addresses(): HasMany
    {
        return $this->hasMany(Address::class);
    }

    /** E-mail des notifications (étape 13) : null = pas d'e-mail */
    public function routeNotificationForMail(): ?string
    {
        return $this->email ?: null;
    }

    /** Numéro des SMS, au format international : null = pas de SMS */
    public function routeNotificationForSms(): ?string
    {
        return Phone::toE164($this->phone);
    }

    public function fullName(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }
}
