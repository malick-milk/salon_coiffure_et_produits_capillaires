<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Facture IMMUABLE (RG-FAC-03) : jamais modifiée après émission ; une correction = un avoir */
class Invoice extends Model
{
    protected $fillable = ['number', 'type', 'order_id', 'booking_id', 'credited_invoice_id', 'customer_id', 'customer_name', 'customer_phone', 'customer_email', 'billing_address', 'company_snapshot', 'subtotal', 'tax_total', 'total', 'issued_at', 'pdf_path'];

    protected function casts(): array
    {
        return ['company_snapshot' => 'array', 'issued_at' => 'datetime', 'subtotal' => 'integer', 'tax_total' => 'integer', 'total' => 'integer'];
    }

    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
}
