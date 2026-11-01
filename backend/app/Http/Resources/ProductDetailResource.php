<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;

/** @mixin Product */
class ProductDetailResource extends ProductSummaryResource
{
    public function toArray(Request $request): array
    {
        // Famille de contenances : le produit principal + toutes ses variantes
        $root = $this->mainProduct ?? $this->resource;
        $family = collect([$root])->merge($root->variants()->active()->get())->unique('id');

        return [
            ...parent::toArray($request),
            'short_description' => $this->short_description,
            'description' => $this->description, // affiché comme TEXTE par le frontend (anti-XSS)
            'hair_types' => $this->hairTypes->map(fn ($h) => ['name' => $h->name, 'slug' => $h->slug])->values(),
            'images' => $this->images->map(fn ($i) => ['url' => $i->path, 'alt' => $i->alt_text ?? $this->displayName()])->values(),
            'variants' => $family->count() > 1
                ? $family->sortByDesc('price')->map(fn (Product $p) => [
                    'slug' => $p->slug, 'unit_size' => $p->unit_size, 'price' => $p->price,
                    'stock_status' => $p->stockStatus(), 'is_current' => $p->id === $this->id,
                ])->values()
                : [],
        ];
    }
}
