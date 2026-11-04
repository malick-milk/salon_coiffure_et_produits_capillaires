<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

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
