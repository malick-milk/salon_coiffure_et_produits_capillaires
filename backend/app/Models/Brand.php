<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property bool $is_house_brand
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Brand extends Model
{
    protected $fillable = ['name', 'slug', 'logo_path', 'is_house_brand', 'is_active'];

    protected function casts(): array
    {
        return ['is_house_brand' => 'boolean', 'is_active' => 'boolean'];
    }

    /** @return HasMany<Product, $this> */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
