<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Address extends Model
{
    protected $fillable = ['customer_id', 'delivery_zone_id', 'label', 'recipient_name', 'phone', 'city', 'district', 'address_line', 'landmark', 'is_default'];

    protected function casts(): array { return ['is_default' => 'boolean']; }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function deliveryZone(): BelongsTo { return $this->belongsTo(DeliveryZone::class); }
}
