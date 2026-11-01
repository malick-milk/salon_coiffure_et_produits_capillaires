<?php

namespace App\Http\Resources;

use App\Models\Product;
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
            'stock_left' => $status === 'low_stock' ? $this->stock_quantity : null, // « Plus que 4 en stock »
            'is_featured' => $this->is_featured,
            'category' => ['id' => $this->category->id, 'name' => $this->category->name, 'slug' => $this->category->slug],
            'image_url' => $this->images->firstWhere('is_primary', true)?->path ?? $this->images->first()?->path,
        ];
    }
}
