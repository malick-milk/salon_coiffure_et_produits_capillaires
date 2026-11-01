<?php

namespace App\Services\Inventory;

use App\Enums\StockMovementType;
use App\Exceptions\InsufficientStockException;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * SEULE porte d'entrée pour modifier un stock (RG-STK-02, ADR-006).
 * Chaque variation = une ligne immuable dans stock_movements + mise à jour du cache products.stock_quantity,
 * le tout dans une TRANSACTION, avec un VERROU sur la ligne du produit (SELECT … FOR UPDATE).
 */
class StockService
{
    /**
     * @param  int  $quantity  signée : +96 (fabrication), -2 (vente)
     */
    public function record(
        Product $product,
        StockMovementType $type,
        int $quantity,
        ?Model $reference = null,
        ?string $reason = null,
        ?int $userId = null,
        ?int $unitCost = null,
    ): StockMovement {
        if ($quantity === 0) {
            throw new LogicException('Un mouvement de stock ne peut pas être nul.');
        }
        if (in_array($type, [StockMovementType::Loss, StockMovementType::Adjustment], true) && blank($reason)) {
            throw new LogicException('Un motif est obligatoire pour une perte ou un ajustement.');
        }

        return DB::transaction(function () use ($product, $type, $quantity, $reference, $reason, $userId, $unitCost) {
            // Verrou : une autre vente simultanée du même produit attend la fin de cette transaction
            $locked = Product::query()->whereKey($product->getKey())->lockForUpdate()->firstOrFail();
            $newStock = $locked->stock_quantity + $quantity;

            if ($newStock < 0) {
                throw new InsufficientStockException([[
                    'product_id' => $locked->id,
                    'name' => $locked->displayName(),
                    'requested' => -$quantity,
                    'available' => $locked->stock_quantity,
                ]]);
            }

            $locked->forceFill(['stock_quantity' => $newStock])->save();
            $product->setRawAttributes($locked->getAttributes(), true); // garder l'objet appelant à jour

            return StockMovement::create([
                'product_id' => $locked->id,
                'type' => $type,
                'quantity' => $quantity,
                'stock_after' => $newStock,
                'unit_cost' => $unitCost,
                'reference_type' => $reference?->getMorphClass(),
                'reference_id' => $reference?->getKey(),
                'reason' => $reason,
                'user_id' => $userId,
            ]);
        });
    }
}
