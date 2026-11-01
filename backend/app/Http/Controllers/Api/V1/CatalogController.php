<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductIndexRequest;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductDetailResource;
use App\Http\Resources\ProductSummaryResource;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Catalogue public. Contrôleur « mince » : il lit la requête validée, interroge les modèles
 * et confie la forme du JSON aux API Resources.
 */
class CatalogController extends Controller
{
    private const PER_PAGE = 12;

    public function categories(): AnonymousResourceCollection
    {
        $categories = Category::query()->where('is_active', true)->orderBy('position')
            ->withCount(['products' => fn ($q) => $q->active()])->get();

        // Une catégorie parente compte aussi les produits de ses sous-catégories
        foreach ($categories->whereNull('parent_id') as $root) {
            $root->product_count = $root->products_count + $categories->where('parent_id', $root->id)->sum('products_count');
        }
        foreach ($categories->whereNotNull('parent_id') as $child) {
            $child->product_count = $child->products_count;
        }

        return CategoryResource::collection($categories->sortBy(fn ($c) => [$c->parent_id !== null, $c->position])->values());
    }

    public function products(ProductIndexRequest $request): JsonResponse
    {
        $f = $request->validated();
        $query = Product::query()->active()->with(['brand', 'category', 'images']);

        if (! empty($f['category'])) {
            $category = Category::query()->where('slug', $f['category'])->first();
            $ids = $category ? Category::query()->where('parent_id', $category->id)->pluck('id')->push($category->id) : collect([0]);
            $query->whereIn('category_id', $ids);
        }
        if (! empty($f['search'])) {
            // Requête préparée (liaison de paramètres) : aucune injection SQL possible.
            // La collation utf8mb4_unicode_ci ignore accents et majuscules : « creme » trouve « Crème ».
            $term = '%'.addcslashes($f['search'], '%_\\').'%';
            $query->where(fn ($q) => $q->where('name', 'like', $term)->orWhere('unit_size', 'like', $term));
        }
        $query->when($request->boolean('featured'), fn ($q) => $q->where('is_featured', true))
            ->when($request->boolean('in_stock'), fn ($q) => $q->where('stock_quantity', '>', 0))
            ->when(isset($f['min_price']), fn ($q) => $q->where('price', '>=', $f['min_price']))
            ->when(isset($f['max_price']), fn ($q) => $q->where('price', '<=', $f['max_price']));

        match ($f['sort'] ?? 'newest') {
            'price_asc' => $query->orderBy('price')->orderBy('id'),
            'price_desc' => $query->orderByDesc('price')->orderBy('id'),
            'name' => $query->orderBy('name')->orderBy('id'),
            default => $query->orderByDesc('created_at')->orderBy('id'),
        };

        $page = $query->paginate(self::PER_PAGE);

        // Format du contrat (types/api.ts → Paginated<T>)
        return response()->json([
            'data' => ProductSummaryResource::collection($page->getCollection())->resolve($request),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    public function product(string $slug): ProductDetailResource
    {
        // firstOrFail() -> 404 automatique si le produit n'existe pas ou n'est pas en vente
        $product = Product::query()->active()->where('slug', $slug)
            ->with(['brand', 'category', 'images', 'hairTypes', 'mainProduct'])->firstOrFail();

        return new ProductDetailResource($product);
    }
}
