<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * Types des colonnes converties (casts) : déclarés pour l'analyse statique (Larastan).
 *
 * @property PaymentMethod $method
 * @property array<string, mixed>|null $provider_payload
 * @property Carbon|null $paid_at
 * @property int $amount
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Payment extends Model
{
    protected $fillable = ['payable_type', 'payable_id', 'gateway', 'method', 'amount', 'status', 'provider_reference', 'provider_payload', 'recorded_by', 'paid_at'];

    protected function casts(): array
    {
        return ['method' => PaymentMethod::class, 'provider_payload' => 'array', 'paid_at' => 'datetime', 'amount' => 'integer'];
    }

    /** @return MorphTo<Model, $this> */
    public function payable(): MorphTo
    {
        return $this->morphTo();
    }
}
