<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\RecordProductionBatchAction;
use App\Enums\ProductionCostCategory;
use App\Enums\ProductOrigin;
use App\Enums\StockMovementType;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\Inventory\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Spatie\Activitylog\Models\Activity;

/** Produits, stock et fabrication (EF-COM-01 à 05). Ici, le coût de revient EST visible (personnel autorisé). */
class CatalogAdminController extends Controller
{
    public function products(): JsonResponse
    {
        $products = Product::query()->with(['category', 'brand', 'images'])->with('bundleItems.component')->withExists(['productionBatches', 'purchaseReceipts'])->orderBy('name')->orderBy('unit_size')->get();

        return response()->json(['data' => $products->map(fn (Product $p) => self::row($p))]);
    }

    /**
     * Modifier un produit (maquette « Modifier un produit », validée le 18 novembre 2026).
     * Règles : la référence (SKU) et l'adresse (slug) ne changent JAMAIS (factures, liens partagés) ;
     * l'origine et le coût de revient se verrouillent dès le premier lot fabriqué ou la première réception d'achat
     * (le coût devient alors la moyenne pondérée). Chaque changement va au journal d'audit (avant / après).
     * Les commandes passées gardent leur prix : il est figé dans order_items au moment de l'achat.
     */
    public function updateProduct(Request $request, Product $product): JsonResponse
    {
        $data = $request->validate([
            'origin' => ['sometimes', Rule::enum(ProductOrigin::class)],
            'name' => ['sometimes', 'string', 'min:2', 'max:120'],
            'brand_id' => ['sometimes', 'integer', 'exists:brands,id'],
            'category_id' => ['sometimes', 'integer', Rule::exists('categories', 'id')->where('is_active', true)],
            'unit_size' => ['sometimes', 'nullable', 'string', 'max:50'],
            'price' => ['sometimes', 'integer', 'min:0', 'max:10000000'],
            'compare_at_price' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'cost_price' => ['sometimes', 'integer', 'min:0', 'max:10000000'],
            'is_active' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'low_stock_threshold' => ['sometimes', 'integer', 'min:0', 'max:100000'],
            'short_description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],
        ], [], ['name' => 'nom du produit', 'brand_id' => 'marque', 'category_id' => 'catégorie', 'price' => 'prix de vente', 'cost_price' => 'coût de revient', 'compare_at_price' => 'prix barré']);

        // Verrous : une fois du stock entré par un lot ou une réception, l'origine et le coût ne se touchent plus
        if ($product->hasStockEntries()) {
            if (array_key_exists('origin', $data) && $data['origin'] !== $product->origin->value) {
                throw ValidationException::withMessages(['origin' => "L'origine ne peut plus changer : du stock est déjà entré par un lot fabriqué ou une réception d'achat."]);
            }
            if (array_key_exists('cost_price', $data) && (float) $data['cost_price'] !== (float) $product->cost_price) {
                throw ValidationException::withMessages(['cost_price' => 'Le coût de revient se calcule maintenant tout seul (moyenne des lots et des réceptions) : il ne se saisit plus à la main.']);
            }
            unset($data['origin'], $data['cost_price']);
        }

        // Pas deux fiches identiques (même marque, même nom, même contenance), la fiche modifiée exceptée
        if (array_key_exists('name', $data) || array_key_exists('brand_id', $data) || array_key_exists('unit_size', $data)) {
            $data['name'] = trim($data['name'] ?? $product->name);
            $data['unit_size'] = array_key_exists('unit_size', $data) ? (trim((string) $data['unit_size']) ?: null) : $product->unit_size;
            $size = $data['unit_size'];
            $duplicate = Product::withTrashed()->whereKeyNot($product->id)->where('brand_id', $data['brand_id'] ?? $product->brand_id)->where('name', $data['name'])
                ->when($size, fn ($q) => $q->where('unit_size', $size), fn ($q) => $q->whereNull('unit_size'))->exists();
            if ($duplicate) {
                throw ValidationException::withMessages(['name' => 'Un autre produit porte déjà ce nom, dans cette marque et cette contenance.']);
            }
        }

        // Le prix barré se compare au prix FINAL : celui envoyé, sinon le prix actuel.
        // (« gt:price » ne voyait que le champ de la requête : un prix barré seul était toujours refusé)
        $price = $data['price'] ?? $product->price;
        $compareAt = array_key_exists('compare_at_price', $data) ? $data['compare_at_price'] : $product->compare_at_price;
        if ($compareAt !== null && $compareAt <= $price) {
            throw ValidationException::withMessages(['compare_at_price' => "Le prix barré doit être supérieur au prix de vente ({$price} F)."]);
        }
        // Le prix membre doit rester sous le prix normal (sinon « −5 000 F » deviendrait une hausse)
        if ($product->member_price !== null && $price <= $product->member_price) {
            throw ValidationException::withMessages(['price' => "Le prix de vente doit rester supérieur au prix membre ({$product->member_price} F)."]);
        }
        // Publier (brouillon -> en vente) exige une photo : une fiche sans photo ne vend pas
        if (($data['is_active'] ?? false) && ! $product->is_active && ! $product->images()->exists()) {
            throw ValidationException::withMessages(['is_active' => 'Ajoutez au moins une photo avant de publier ce produit.']);
        }
        $product->update($data); // tracé dans le journal d'audit (valeurs avant / après)

        return response()->json(['data' => self::row($product->fresh(['category', 'brand', 'images']))]);
    }

    /** « Dernières modifications » d'un produit : les 5 dernières lignes du journal d'audit qui le concernent */
    public function history(Product $product): JsonResponse
    {
        $rows = Activity::query()->with('causer')->where('subject_type', $product->getMorphClass())->where('subject_id', $product->id)
            ->where('log_name', 'products')->latest('id')->limit(5)->get();

        return response()->json(['data' => $rows->map(function (Activity $a) {
            $new = (array) ($a->properties['attributes'] ?? []);
            $old = (array) ($a->properties['old'] ?? []);

            return [
                'id' => $a->id, 'event' => $a->event,
                'causer' => $a->causer instanceof User ? trim($a->causer->first_name.' '.$a->causer->last_name) : 'Système',
                'created_at' => Carbon::make($a->created_at)?->format('Y-m-d\TH:i:s'),
                // Seulement les champs qui ont changé, pour une phrase courte : « prix 5 500 -> 6 000 F »
                'changes' => collect($new)->map(fn ($value, $field) => ['field' => $field, 'old' => $old[$field] ?? null, 'new' => $value])->values(),
            ];
        })]);
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
        if ($product->is_bundle) {
            throw ValidationException::withMessages(['type' => 'Une gamme n’a pas de stock à elle : son stock, c’est celui de ses 6 soins. Faites entrer les soins un par un.']);
        }
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

        return response()->json(['data' => self::row($product->fresh(['category', 'brand', 'images']))], 201);
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
        $target = Product::query()->find($data['product_id']);
        if ($target?->is_bundle) {
            throw ValidationException::withMessages(['product_id' => 'Une gamme n’a pas de stock à elle : son stock, c’est celui de ses 6 soins. Faites entrer les soins un par un.']);
        }
        if ($target?->origin === ProductOrigin::Resold) {
            throw ValidationException::withMessages(['product_id' => "Ce produit est acheté et revendu : son stock entre par une réception d'achat."]);
        }
        $batch = $record->execute($data, $request->user());

        return response()->json(['data' => ['id' => $batch->id, 'batch_number' => $batch->batch_number, 'unit_cost' => $batch->unit_cost !== null ? (float) $batch->unit_cost : null]], 201);
    }

    /** Ligne « produit » de l'ERP (coût de revient visible : personnel autorisé uniquement) */
    public static function row(Product $p): array
    {
        return [
            'id' => $p->id, 'sku' => $p->sku, 'origin' => $p->origin->value, 'brand_id' => $p->brand_id, 'category_id' => $p->category_id,
            'images' => $p->images->map(fn ($i) => ['id' => $i->id, 'url' => $i->path, 'alt' => $i->alt_text, 'is_primary' => $i->is_primary])->values(), 'name' => $p->name, 'unit_size' => $p->unit_size, 'slug' => $p->slug,
            'category' => $p->category->name, 'brand' => $p->brand?->name, 'price' => $p->price, 'compare_at_price' => $p->compare_at_price,
            'cost_price' => $p->cost_price !== null ? (float) $p->cost_price : null,
            'margin_rate' => $p->cost_price !== null && $p->price > 0 ? round(100 * ($p->price - (float) $p->cost_price) / $p->price, 1) : null,
            // Gamme : nombre de gammes complètes qu'on peut former avec le stock des composants
            'is_bundle' => $p->is_bundle, 'member_price' => $p->member_price, 'member_price_limit' => $p->member_price_limit,
            'stock_quantity' => $p->availableQuantity(), 'low_stock_threshold' => $p->low_stock_threshold, 'stock_status' => $p->stockStatus(),
            // Origine et coût verrouillés : du stock est déjà entré par un lot fabriqué ou une réception d'achat
            'stock_entries_locked' => $p->hasStockEntries(),
            'is_active' => $p->is_active, 'is_featured' => $p->is_featured, 'short_description' => $p->short_description, 'description' => $p->description,
        ];
    }
}
