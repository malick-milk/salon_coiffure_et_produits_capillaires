<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Bon de dépôt : produits livrés à un point de retrait (ils restent à Dabo Hair) */
class ConsignmentDelivery extends Model
{
    protected $fillable = ['number', 'pickup_point_id', 'delivered_on', 'total_quantity', 'total_value', 'created_by'];

    protected function casts(): array
    {
        return ['delivered_on' => 'date', 'total_quantity' => 'integer', 'total_value' => 'integer'];
    }

    public function items(): HasMany
    {
        return $this->hasMany(ConsignmentDeliveryItem::class);
    }

    public function pickupPoint(): BelongsTo
    {
        return $this->belongsTo(PickupPoint::class);
    }
}
