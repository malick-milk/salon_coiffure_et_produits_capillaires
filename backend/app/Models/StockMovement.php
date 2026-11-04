<?php

namespace App\Models;

use App\Enums\StockMovementType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/** Ligne du grand livre de stock : immuable (pas d'updated_at) */
class StockMovement extends Model
{
    const UPDATED_AT = null;

    protected $fillable = ['product_id', 'type', 'quantity', 'stock_after', 'unit_cost', 'reference_type', 'reference_id', 'reason', 'user_id'];

    protected function casts(): array
    {
        return ['type' => StockMovementType::class, 'quantity' => 'integer', 'stock_after' => 'integer'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }
}
