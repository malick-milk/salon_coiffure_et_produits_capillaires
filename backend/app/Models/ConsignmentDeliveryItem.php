<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property int $unit_price
 * @property int $quantity
 * @property int $line_total
 */
class ConsignmentDeliveryItem extends Model
{
    public $timestamps = false;

    protected $fillable = ['consignment_delivery_id', 'product_id', 'product_name', 'unit_price', 'quantity', 'line_total'];

    protected function casts(): array
    {
        return ['unit_price' => 'integer', 'quantity' => 'integer', 'line_total' => 'integer'];
    }
}
