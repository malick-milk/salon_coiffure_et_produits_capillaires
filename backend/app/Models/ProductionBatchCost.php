<?php

namespace App\Models;

use App\Enums\ProductionCostCategory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductionBatchCost extends Model
{
    protected $fillable = ['production_batch_id', 'category', 'label', 'amount', 'spent_on', 'created_by'];

    protected function casts(): array { return ['category' => ProductionCostCategory::class, 'spent_on' => 'date']; }

    public function batch(): BelongsTo { return $this->belongsTo(ProductionBatch::class, 'production_batch_id'); }
}
