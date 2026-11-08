<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ConsignmentDeliveryItem extends Model
{
    public $timestamps = false;

    protected $fillable = ['consignment_delivery_id', 'product_id', 'product_name', 'unit_price', 'quantity', 'line_total'];

    protected function casts(): array
    {
        return ['unit_price' => 'integer', 'quantity' => 'integer', 'line_total' => 'integer'];
    }
}
