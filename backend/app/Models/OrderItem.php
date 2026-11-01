<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Ligne de commande : prix et nom FIGÉS au moment de l'achat (RG-COM-03) */
class OrderItem extends Model
{
    protected $fillable = ['order_id', 'product_id', 'product_name', 'sku', 'unit_price', 'unit_cost', 'quantity', 'line_total'];

    protected function casts(): array
    {
        return ['unit_price' => 'integer', 'unit_cost' => 'decimal:2', 'quantity' => 'integer', 'line_total' => 'integer'];
    }

    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class)->withTrashed(); }
}
