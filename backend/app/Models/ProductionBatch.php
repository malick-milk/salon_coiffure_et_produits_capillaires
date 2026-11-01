<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Lot de fabrication (marque Dabo Hair). unit_cost est une colonne GÉNÉRÉE par MySQL. */
class ProductionBatch extends Model
{
    protected $fillable = ['batch_number', 'product_id', 'quantity_produced', 'total_cost', 'produced_on', 'expires_on', 'notes', 'created_by'];

    protected function casts(): array
    {
        return ['produced_on' => 'date', 'expires_on' => 'date', 'unit_cost' => 'decimal:2', 'total_cost' => 'integer'];
    }

    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function costs(): HasMany { return $this->hasMany(ProductionBatchCost::class); }
}
