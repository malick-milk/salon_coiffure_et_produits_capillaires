<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Une ligne de gamme : « la Gamme complète contient 1 Leave In ».
 *
 * @property int $bundle_id
 * @property int $component_id
 * @property int $quantity
 */
class ProductBundleItem extends Model
{
    protected $fillable = ['bundle_id', 'component_id', 'quantity'];

    protected function casts(): array
    {
        return ['quantity' => 'integer'];
    }

    /** @return BelongsTo<Product, $this> */
    public function bundle(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'bundle_id');
    }

    /** @return BelongsTo<Product, $this> */
    public function component(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'component_id');
    }
}
