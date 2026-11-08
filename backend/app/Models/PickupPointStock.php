<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Stock confié à un point de retrait, produit par produit (clé : point + produit ; écritures via PickupPointService) */
class PickupPointStock extends Model
{
    public $incrementing = false;

    protected $primaryKey = null;

    protected $fillable = ['pickup_point_id', 'product_id', 'quantity'];

    protected function casts(): array
    {
        return ['quantity' => 'integer'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
