<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Bon de dépôt : produits livrés à un point de retrait (ils restent à Dabo Hair)
 *
 * Types des colonnes converties (casts) : déclarés pour l'analyse statique (Larastan).
 *
 * @property Carbon $delivered_on
 * @property int $total_quantity
 * @property int $total_value
 */
class ConsignmentDelivery extends Model
{
    protected $fillable = ['number', 'pickup_point_id', 'delivered_on', 'total_quantity', 'total_value', 'created_by'];

    protected function casts(): array
    {
        return ['delivered_on' => 'date', 'total_quantity' => 'integer', 'total_value' => 'integer'];
    }

    /** @return HasMany<ConsignmentDeliveryItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(ConsignmentDeliveryItem::class);
    }

    /** @return BelongsTo<PickupPoint, $this> */
    public function pickupPoint(): BelongsTo
    {
        return $this->belongsTo(PickupPoint::class);
    }
}
