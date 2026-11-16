<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Stock confié à un point de retrait, produit par produit (clé : point + produit ; écritures via PickupPointService)
 *
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property int $quantity
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PickupPointStock extends Model
{
    public $incrementing = false;

    protected $primaryKey = null;

    protected $fillable = ['pickup_point_id', 'product_id', 'quantity'];

    protected function casts(): array
    {
        return ['quantity' => 'integer'];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
