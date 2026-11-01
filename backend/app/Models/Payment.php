<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Payment extends Model
{
    protected $fillable = ['payable_type', 'payable_id', 'gateway', 'method', 'amount', 'status', 'provider_reference', 'provider_payload', 'recorded_by', 'paid_at'];

    protected function casts(): array
    {
        return ['method' => PaymentMethod::class, 'provider_payload' => 'array', 'paid_at' => 'datetime', 'amount' => 'integer'];
    }

    public function payable(): MorphTo { return $this->morphTo(); }
}
