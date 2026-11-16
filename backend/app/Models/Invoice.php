<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Facture IMMUABLE (RG-FAC-03) : jamais modifiée après émission ; une correction = un avoir
 *
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property array<array-key, mixed> $company_snapshot
 * @property Carbon $issued_at
 * @property int $subtotal
 * @property int $tax_total
 * @property int $total
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Invoice extends Model
{
    protected $fillable = ['number', 'type', 'order_id', 'booking_id', 'credited_invoice_id', 'customer_id', 'customer_name', 'customer_phone', 'customer_email', 'billing_address', 'company_snapshot', 'subtotal', 'tax_total', 'total', 'issued_at', 'pdf_path'];

    protected function casts(): array
    {
        return ['company_snapshot' => 'array', 'issued_at' => 'datetime', 'subtotal' => 'integer', 'tax_total' => 'integer', 'total' => 'integer'];
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
