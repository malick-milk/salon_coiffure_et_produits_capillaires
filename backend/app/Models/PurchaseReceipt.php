<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** Réception d'achat d'un produit revendu (fournisseur, quantité, prix d'achat, frais du lot) */
class PurchaseReceipt extends Model
{
    use LogsActivity;

    protected $fillable = ['product_id', 'supplier_name', 'supplier_invoice', 'received_on', 'quantity', 'unit_price', 'extra_costs', 'unit_cost', 'notes', 'created_by'];

    protected function casts(): array
    {
        return ['received_on' => 'date', 'quantity' => 'integer', 'unit_price' => 'integer', 'extra_costs' => 'integer', 'unit_cost' => 'decimal:2'];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Journal d'audit (RG-SEC-01) */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('purchases')->logOnly(['product_id', 'supplier_name', 'supplier_invoice', 'quantity', 'unit_price', 'extra_costs'])->dontSubmitEmptyLogs();
    }
}
