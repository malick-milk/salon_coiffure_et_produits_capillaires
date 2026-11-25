<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;

/**
 * @mixin Product
 */
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
            // Ce que contient une gamme (« Shampooing sans sulfate », « Leave In 250 ml »…)
            'bundle_items' => $this->is_bundle
                ? $this->bundleItems->map(fn ($i) => ['name' => $i->component->displayName(), 'slug' => $i->component->slug, 'quantity' => $i->quantity])->values()
                : [],
            'images' => $this->images->map(fn ($i) => ['url' => $i->path, 'alt' => $i->alt_text ?? $this->displayName()])->values(),
            'variants' => $family->count() > 1
                ? $family->sortByDesc('price')->map(fn (Product $p) => [
                    'slug' => $p->slug, 'unit_size' => $p->unit_size, 'price' => $p->price,
                    'stock_status' => $p->stockStatus(), 'is_current' => $p->id === $this->id,
                ])->values()
                : [],
            // « Mieux en routine » (maquette validée le 25 novembre 2026) : LA gamme en vente qui contient ce produit
            'in_bundle' => $this->is_bundle ? null : $this->bundleOffer(),
        ];
    }

    /**
     * La gamme en vente (et en stock) la moins chère qui contient ce produit, avec ce qu'elle fait économiser
     * par rapport à ses produits achetés un par un. Une seule proposition : trop de choix ne fait pas vendre.
     *
     * @return array{id:int,slug:string,name:string,unit_size:?string,price:int,member_price:?int,separate_price:int,saving:int,contents:list<string>}|null
     */
    private function bundleOffer(): ?array
    {
        $bundles = Product::query()->active()->where('is_bundle', true)
            ->whereHas('bundleItems', fn ($q) => $q->where('component_id', $this->id))
            ->with('bundleItems.component')->orderBy('price')->get()
            ->filter(fn (Product $b) => $b->availableQuantity() > 0);
        $bundle = $bundles->first();
        if ($bundle === null) {
            return null;
        }
        $separate = (int) $bundle->bundleItems->sum(fn ($i) => $i->component->price * $i->quantity);

        return [
            'id' => $bundle->id,
            'slug' => $bundle->slug,
            'name' => $bundle->name,
            'unit_size' => $bundle->unit_size,
            'price' => $bundle->price,
            'member_price' => $bundle->member_price,
            'separate_price' => $separate,
            'saving' => max(0, $separate - $bundle->price),
            'contents' => $bundle->bundleItems->map(fn ($i) => ($i->quantity > 1 ? "{$i->quantity} × " : '').$i->component->displayName())->values()->all(),
        ];
    }
}
