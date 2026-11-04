<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\RecordProductionBatchAction;
use App\Enums\ProductionCostCategory;
use App\Enums\StockMovementType;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\StockMovement;
use App\Services\Inventory\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Produits, stock et fabrication (EF-COM-01 à 05). Ici, le coût de revient EST visible (personnel autorisé). */
class CatalogAdminController extends Controller
{
    public function products(): JsonResponse
    {
        $products = Product::query()->with(['category', 'brand'])->orderBy('name')->orderBy('unit_size')->get();

        return response()->json(['data' => $products->map(fn (Product $p) => $this->productRow($p))]);
    }

    public function updateProduct(Request $request, Product $product): JsonResponse
    {
        $data = $request->validate([
            'price' => ['sometimes', 'integer', 'min:0', 'max:10000000'],
            'compare_at_price' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'low_stock_threshold' => ['sometimes', 'integer', 'min:0', 'max:100000'],
            'short_description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],
        ]);
        // Le prix barré se compare au prix FINAL : celui envoyé, sinon le prix actuel.
        // (« gt:price » ne voyait que le champ de la requête : un prix barré seul était toujours refusé)
        $price = $data['price'] ?? $product->price;
        $compareAt = array_key_exists('compare_at_price', $data) ? $data['compare_at_price'] : $product->compare_at_price;
        if ($compareAt !== null && $compareAt <= $price) {
            throw ValidationException::withMessages(['compare_at_price' => "Le prix barré doit être supérieur au prix de vente ({$price} F)."]);
        }
        $product->update($data); // tracé dans le journal d'audit (valeurs avant / après)

        return response()->json(['data' => $this->productRow($product->fresh(['category', 'brand']))]);
    }

    public function movements(Product $product): JsonResponse
    {
        $rows = StockMovement::query()->where('product_id', $product->id)->with('product')->latest('id')->limit(100)->get();

        return response()->json(['data' => $rows->map(fn (StockMovement $m) => [
            'type' => $m->type->value, 'quantity' => $m->quantity, 'stock_after' => $m->stock_after, 'reason' => $m->reason,
            'reference' => $m->reference_type ? class_basename($m->reference_type).' #'.$m->reference_id : null,
            'created_at' => $m->created_at?->format('Y-m-d\TH:i:s'),
        ])]);
    }

    /** Perte, ajustement d'inventaire ou retour client : TOUJOURS via le grand livre, avec un motif */
    public function adjustStock(Request $request, Product $product, StockService $stock): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in([StockMovementType::Loss->value, StockMovementType::Adjustment->value, StockMovementType::CustomerReturn->value])],
            'quantity' => ['required', 'integer', 'not_in:0', 'min:-100000', 'max:100000'],
            'reason' => ['required', 'string', 'min:3', 'max:255'],
        ]);
        $type = StockMovementType::from($data['type']);
        // Une perte est toujours une SORTIE, un retour toujours une ENTRÉE ; un ajustement peut être les deux
        $quantity = match ($type) {
            StockMovementType::Loss => -abs($data['quantity']),
            StockMovementType::CustomerReturn => abs($data['quantity']),
            default => $data['quantity'],
        };
        $movement = $stock->record($product, $type, $quantity, reason: $data['reason'], userId: $request->user()->id);
        activity('stock')->performedOn($product)->causedBy($request->user())
            ->withProperties(['type' => $type->value, 'quantity' => $quantity, 'stock_after' => $movement->stock_after, 'reason' => $data['reason']])
            ->event('adjusted')->log('stock adjusted');

        return response()->json(['data' => $this->productRow($product->fresh(['category', 'brand']))], 201);
    }

    public function batches(): JsonResponse
    {
        $batches = ProductionBatch::query()->with(['product', 'costs'])->latest('produced_on')->latest('id')->get();

        return response()->json(['data' => $batches->map(fn (ProductionBatch $b) => [
            'id' => $b->id, 'batch_number' => $b->batch_number, 'product_id' => $b->product_id, 'product_name' => $b->product->displayName(),
            'quantity_produced' => $b->quantity_produced, 'total_cost' => $b->total_cost, 'unit_cost' => $b->unit_cost !== null ? (float) $b->unit_cost : null,
            'produced_on' => $b->produced_on->toDateString(), 'expires_on' => $b->expires_on?->toDateString(),
            'days_before_expiry' => $b->expires_on ? (int) now()->startOfDay()->diffInDays($b->expires_on, false) : null,
            'costs' => $b->costs->map(fn ($c) => ['category' => $c->category->value, 'label' => $c->label, 'amount' => $c->amount]),
            'potential_revenue' => $b->quantity_produced * $b->product->price,
            'potential_margin' => $b->total_cost !== null ? $b->quantity_produced * $b->product->price - $b->total_cost : null,
        ])]);
    }

    public function storeBatch(Request $request, RecordProductionBatchAction $record): JsonResponse
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'batch_number' => ['required', 'string', 'max:40', 'unique:production_batches,batch_number'],
            'quantity_produced' => ['required', 'integer', 'min:1', 'max:100000'],
            'produced_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'expires_on' => ['nullable', 'date_format:Y-m-d', 'after:produced_on'],
            'notes' => ['nullable', 'string', 'max:500'],
            'costs' => ['nullable', 'array', 'max:20'],
            'costs.*.category' => ['required', Rule::enum(ProductionCostCategory::class)],
            'costs.*.label' => ['required', 'string', 'max:150'],
            'costs.*.amount' => ['required', 'integer', 'min:1', 'max:100000000'],
        ], ['batch_number.unique' => 'Ce numéro de lot existe déjà.']);
        $batch = $record->execute($data, $request->user());

        return response()->json(['data' => ['id' => $batch->id, 'batch_number' => $batch->batch_number, 'unit_cost' => $batch->unit_cost !== null ? (float) $batch->unit_cost : null]], 201);
    }

    private function productRow(Product $p): array
    {
        return [
            'id' => $p->id, 'sku' => $p->sku, 'name' => $p->name, 'unit_size' => $p->unit_size, 'slug' => $p->slug,
            'category' => $p->category->name, 'brand' => $p->brand?->name, 'price' => $p->price, 'compare_at_price' => $p->compare_at_price,
            'cost_price' => $p->cost_price !== null ? (float) $p->cost_price : null,
            'margin_rate' => $p->cost_price !== null && $p->price > 0 ? round(100 * ($p->price - (float) $p->cost_price) / $p->price, 1) : null,
            'stock_quantity' => $p->stock_quantity, 'low_stock_threshold' => $p->low_stock_threshold, 'stock_status' => $p->stockStatus(),
            'is_active' => $p->is_active, 'is_featured' => $p->is_featured, 'short_description' => $p->short_description, 'description' => $p->description,
        ];
    }
}
