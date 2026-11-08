<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ConsignmentStatementItem extends Model
{
    public $timestamps = false;

    protected $fillable = ['consignment_statement_id', 'product_id', 'product_name', 'unit_price', 'expected_qty', 'counted_qty', 'damaged_qty', 'counter_sold_qty', 'online_qty'];

    protected function casts(): array
    {
        return ['unit_price' => 'integer', 'expected_qty' => 'integer', 'counted_qty' => 'integer', 'damaged_qty' => 'integer', 'counter_sold_qty' => 'integer', 'online_qty' => 'integer'];
    }
}
