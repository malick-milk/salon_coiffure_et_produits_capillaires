<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property int $unit_price
 * @property int $expected_qty
 * @property int $counted_qty
 * @property int $damaged_qty
 * @property int $counter_sold_qty
 * @property int $online_qty
 */
class ConsignmentStatementItem extends Model
{
    public $timestamps = false;

    protected $fillable = ['consignment_statement_id', 'product_id', 'product_name', 'unit_price', 'expected_qty', 'counted_qty', 'damaged_qty', 'counter_sold_qty', 'online_qty'];

    protected function casts(): array
    {
        return ['unit_price' => 'integer', 'expected_qty' => 'integer', 'counted_qty' => 'integer', 'damaged_qty' => 'integer', 'counter_sold_qty' => 'integer', 'online_qty' => 'integer'];
    }
}
