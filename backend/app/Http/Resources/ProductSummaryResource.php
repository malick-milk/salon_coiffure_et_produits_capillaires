<?php

namespace App\Http\Resources;

use App\Models\Product;
use App\Services\Catalog\MemberPriceService;
use App\Services\Catalog\PromotionService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Produit dans une liste (contrat : frontend/src/types/api.ts → ProductSummary).
 * La Resource CHOISIT les champs exposés : cost_price et le stock exact ne sortent JAMAIS.
 *
 * @mixin Product
 */
class ProductSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $status = $this->stockStatus();

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'name' => $this->name,
            'brand' => $this->brand ? ['name' => $this->brand->name, 'slug' => $this->brand->slug] : null,
            'unit_size' => $this->unit_size,
            'price' => $this->price,
            'compare_at_price' => $this->compare_at_price,
            'stock_status' => $status,
            'stock_left' => $status === 'low_stock' ? $this->availableQuantity() : null, // « Plus que 4 en stock »
            'is_bundle' => $this->is_bundle,
            // Promotion en cours (le prix initial « price » ne change pas) ; applies : vaut-elle pour CETTE visiteuse ?
            'promotion' => $this->promotionData($request),
            // Prix membre (lancement du 15 décembre) : le prix, les places restantes, et la situation de CETTE visiteuse
            'member_price' => $this->member_price,
            'member_offer' => $this->member_price !== null ? [
                'limit' => $this->member_price_limit,
                'remaining' => app(MemberPriceService::class)->remaining($this->resource),
                'status' => app(MemberPriceService::class)->status($request->user('sanctum'), $this->resource),
            ] : null,
            'is_featured' => $this->is_featured,
            'category' => ['id' => $this->category->id, 'name' => $this->category->name, 'slug' => $this->category->slug],
            'image_url' => $this->images->firstWhere('is_primary', true)->path ?? $this->images->first()->path ?? null,
        ];
    }

    /** @return array{percent:int,price:int,ends_on:string,audience:string,applies:bool}|null */
    private function promotionData(Request $request): ?array
    {
        $service = app(PromotionService::class);
        $promotion = $service->running($this->resource);
        if ($promotion === null) {
            return null;
        }

        return [
            'percent' => $promotion->percent,
            'price' => PromotionService::discounted($this->price, $promotion->percent),
            'ends_on' => $promotion->lastDay()->toDateString(),
            'audience' => $promotion->audience,
            'applies' => $service->applicable($this->resource, $request->user('sanctum')) !== null,
        ];
    }
}
