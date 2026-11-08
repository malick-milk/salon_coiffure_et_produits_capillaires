<?php

namespace App\Models;

use App\Support\Phone;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Notifications\Notifiable;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** Point de retrait partenaire : une boutique existante qui garde un stock confié (étape 14) */
class PickupPoint extends Model
{
    use LogsActivity, Notifiable;

    /** Les 14 régions administratives du Sénégal */
    public const REGIONS = ['Dakar', 'Diourbel', 'Fatick', 'Kaffrine', 'Kaolack', 'Kédougou', 'Kolda', 'Louga', 'Matam', 'Saint-Louis', 'Sédhiou', 'Tambacounda', 'Thiès', 'Ziguinchor'];

    protected $fillable = ['name', 'owner_name', 'phone', 'email', 'regions', 'city', 'address', 'opening_hours', 'commission_rate', 'customer_id', 'is_active', 'notes'];

    protected function casts(): array
    {
        return ['regions' => 'array', 'commission_rate' => 'decimal:2', 'is_active' => 'boolean'];
    }

    public function stocks(): HasMany
    {
        return $this->hasMany(PickupPointStock::class);
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(ConsignmentDelivery::class);
    }

    public function statements(): HasMany
    {
        return $this->hasMany(ConsignmentStatement::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    public function routeNotificationForSms(): ?string
    {
        return Phone::toE164($this->phone);
    }

    public function routeNotificationForMail(): ?string
    {
        return $this->email ?: null;
    }

    /** Pour les messages : « Bonjour Moussa » */
    public function getFirstNameAttribute(): string
    {
        return explode(' ', trim($this->owner_name))[0] ?? $this->owner_name;
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('pickup_points')->logFillable()->logOnlyDirty()->dontSubmitEmptyLogs();
    }
}
