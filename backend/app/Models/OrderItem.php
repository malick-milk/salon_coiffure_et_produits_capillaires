<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Ligne de commande : prix et nom FIGÉS au moment de l'achat (RG-COM-03)
 *
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property int $unit_price
 * @property int|null $regular_unit_price
 * @property string|null $unit_cost
 * @property int $quantity
 * @property int $line_total
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class OrderItem extends Model
{
    protected $fillable = ['order_id', 'product_id', 'product_name', 'sku', 'unit_price', 'regular_unit_price', 'unit_cost', 'quantity', 'line_total'];

    protected function casts(): array
    {
        return ['unit_price' => 'integer', 'regular_unit_price' => 'integer', 'unit_cost' => 'decimal:2', 'quantity' => 'integer', 'line_total' => 'integer'];
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }
}
