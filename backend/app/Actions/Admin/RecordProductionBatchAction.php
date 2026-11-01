<?php

namespace App\Actions\Admin;

use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\User;
use App\Services\Inventory\StockService;
use Illuminate\Support\Facades\DB;

/**
 * Enregistrer un lot fabriqué : les postes de coût, le stock (mouvement « production »)
 * et le nouveau coût de revient du produit. Tout ou rien (transaction).
 */
class RecordProductionBatchAction
{
    public function __construct(private StockService $stock) {}

    /** @param array{product_id:int,batch_number:string,quantity_produced:int,produced_on:string,expires_on:?string,notes:?string,costs:list<array{category:string,label:string,amount:int}>} $data */
    public function execute(array $data, User $by): ProductionBatch
    {
        return DB::transaction(function () use ($data, $by) {
            $product = Product::query()->findOrFail($data['product_id']);
            $costs = collect($data['costs'] ?? []);

            $batch = ProductionBatch::create([
                'batch_number' => $data['batch_number'],
                'product_id' => $product->id,
                'quantity_produced' => $data['quantity_produced'],
                'total_cost' => $costs->isEmpty() ? null : $costs->sum('amount'), // = somme des postes (contrôle 4c de verify.sh)
                'produced_on' => $data['produced_on'],
                'expires_on' => $data['expires_on'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $by->id,
            ]);
            foreach ($costs as $cost) {
                $batch->costs()->create([...$cost, 'spent_on' => $data['produced_on'], 'created_by' => $by->id]);
            }
            $batch->refresh(); // relit unit_cost, calculé par MySQL (colonne générée)

            if ($batch->unit_cost !== null) {
                $product->update(['cost_price' => $batch->unit_cost]); // coût de revient = celui du dernier lot
            }
            $this->stock->record($product, StockMovementType::Production, $batch->quantity_produced, $batch, "Fabrication {$batch->batch_number}", $by->id, $batch->unit_cost !== null ? (int) round((float) $batch->unit_cost) : null);

            return $batch;
        });
    }
}
