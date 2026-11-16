<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Lot de fabrication (marque Dabo Hair). unit_cost est une colonne GÉNÉRÉE par MySQL.
 *
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property Carbon $produced_on
 * @property Carbon|null $expires_on
 * @property string|null $unit_cost
 * @property int|null $total_cost
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class ProductionBatch extends Model
{
    use LogsActivity;

    protected $fillable = ['batch_number', 'product_id', 'quantity_produced', 'total_cost', 'produced_on', 'expires_on', 'notes', 'created_by'];

    protected function casts(): array
    {
        return ['produced_on' => 'date', 'expires_on' => 'date', 'unit_cost' => 'decimal:2', 'total_cost' => 'integer'];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return HasMany<ProductionBatchCost, $this> */
    public function costs(): HasMany
    {
        return $this->hasMany(ProductionBatchCost::class);
    }

    /** Journal d'audit (RG-SEC-01) : qui a modifié quoi, avec les valeurs avant et après */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('production')->logOnly(['batch_number', 'quantity_produced', 'total_cost', 'expires_on'])->logOnlyDirty()->dontSubmitEmptyLogs();
    }
}
