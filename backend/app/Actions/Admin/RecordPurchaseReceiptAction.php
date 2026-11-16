<?php

namespace App\Actions\Admin;

use App\Enums\ProductOrigin;
use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\PurchaseReceipt;
use App\Models\User;
use App\Services\Inventory\StockService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Enregistrer une réception d'achat (produit acheté et revendu) : le stock entre par le grand livre
 * (mouvement « purchase ») et le coût de revient devient la MOYENNE PONDÉRÉE du stock.
 *
 * Exemple : 10 unités en stock à 2 000 F, on reçoit 20 unités à 2 600 F
 *   (10 × 2 000 + 20 × 2 600) ÷ 30 = 72 000 ÷ 30 = 2 400 F l'unité.
 * Avec le « dernier prix » (2 600 F), la marge des 10 premières unités serait sous-estimée.
 */
class RecordPurchaseReceiptAction
{
    public function __construct(private StockService $stock) {}

    /** @param array{product_id:int,supplier_name:string,supplier_invoice:?string,received_on:string,quantity:int,unit_price:int,extra_costs:?int,notes:?string} $data */
    public function execute(array $data, User $by): PurchaseReceipt
    {
        return DB::transaction(function () use ($data, $by) {
            // Verrou : une vente simultanée ne peut pas changer le stock pendant le calcul de la moyenne
            $product = Product::query()->whereKey($data['product_id'])->lockForUpdate()->firstOrFail();
            if ($product->origin !== ProductOrigin::Resold) {
                throw ValidationException::withMessages(['product_id' => 'Ce produit est fabriqué par Dabo Hair : son stock entre par la Fabrication.']);
            }

            $quantity = $data['quantity'];
            $extra = $data['extra_costs'] ?? 0;
            $unitCost = round(($quantity * $data['unit_price'] + $extra) / $quantity, 2);

            $receipt = PurchaseReceipt::create([
                'product_id' => $product->id,
                'supplier_name' => $data['supplier_name'],
                'supplier_invoice' => $data['supplier_invoice'] ?? null,
                'received_on' => $data['received_on'],
                'quantity' => $quantity,
                'unit_price' => $data['unit_price'],
                'extra_costs' => $extra,
                'unit_cost' => $unitCost,
                'notes' => $data['notes'] ?? null,
                'created_by' => $by->id,
            ]);

            $stockBefore = $product->stock_quantity;
            $costBefore = $product->cost_price !== null ? (float) $product->cost_price : null;
            // Sans coût connu ou sans stock, la moyenne se réduit au coût de cette réception
            $newCost = $costBefore === null || $stockBefore <= 0
                ? $unitCost
                : round(($stockBefore * $costBefore + $quantity * $unitCost) / ($stockBefore + $quantity), 2);
            $product->update(['cost_price' => $newCost]); // tracé dans le journal d'audit (avant / après)

            $this->stock->record($product, StockMovementType::Purchase, $quantity, $receipt, "Achat {$data['supplier_name']}", $by->id, (int) round($unitCost));

            return $receipt->setRelation('product', $product);
        });
    }
}
