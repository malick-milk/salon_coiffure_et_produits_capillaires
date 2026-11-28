<?php

namespace App\Models;

use App\Enums\CustomerType;
use App\Support\Phone;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;

/**
 * Client MÉTIER : inscrit (user_id) ou invité (user_id NULL). DATABASE.md §3.1
 *
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property CustomerType $customer_type
 * @property bool $marketing_consent
 * @property bool $resserrage_opt_out
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read int|string|null $orders_spent calculé par la requête (withCount, withSum ou AVG … AS)
 * @property-read int|string|null $bookings_spent calculé par la requête (withCount, withSum ou AVG … AS)
 */
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

    /** Preuves des accords et retraits pour les offres (customer_consents) @return \Illuminate\Database\Eloquent\Relations\HasMany<CustomerConsent, $this> */
    public function consents(): HasMany
    {
        return $this->hasMany(CustomerConsent::class);
    }
}
