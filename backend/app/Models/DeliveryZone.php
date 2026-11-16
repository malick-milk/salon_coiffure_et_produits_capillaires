<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property int $fee
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class DeliveryZone extends Model
{
    protected $fillable = ['name', 'fee', 'is_active'];

    protected function casts(): array
    {
        return ['fee' => 'integer', 'is_active' => 'boolean'];
    }

    /** Portée locale : DeliveryZone::active()->get() */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }
}
