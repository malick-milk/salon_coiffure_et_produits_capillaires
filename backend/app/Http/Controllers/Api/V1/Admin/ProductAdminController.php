<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ProductOrigin;
use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Services\Catalog\ProductImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Créer un produit depuis l'ERP (maquette « Nouveau produit », validée le 16 novembre 2026).
 * Un produit naît en BROUILLON (invisible sur le site) ; il est publié quand il a au moins une photo.
 */
class ProductAdminController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'origin' => ['required', Rule::enum(ProductOrigin::class)],
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'brand_id' => ['required', 'integer', 'exists:brands,id'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'unit_size' => ['nullable', 'string', 'max:50'],
            'price' => ['required', 'integer', 'min:0', 'max:10000000'],
            'low_stock_threshold' => ['sometimes', 'integer', 'min:0', 'max:100000'],
            'short_description' => ['nullable', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:10000'],
        ], [], ['name' => 'nom du produit', 'brand_id' => 'marque', 'category_id' => 'catégorie', 'price' => 'prix de vente']);

        $name = trim($data['name']);
        $size = isset($data['unit_size']) ? trim($data['unit_size']) : null;
        $duplicate = Product::withTrashed()->where('brand_id', $data['brand_id'])->where('name', $name)
            ->when($size, fn ($q) => $q->where('unit_size', $size), fn ($q) => $q->whereNull('unit_size'))->exists();
        if ($duplicate) {
            throw ValidationException::withMessages(['name' => 'Ce produit existe déjà dans cette marque et cette contenance.']);
        }

        $brand = Brand::query()->findOrFail($data['brand_id']);
        $product = Product::create([
            ...$data,
            'name' => $name,
            'unit_size' => $size ?: null,
            'sku' => $this->uniqueSku($brand, $name, $size),
            'slug' => $this->uniqueSlug(trim($name.' '.($size ?? ''))),
            'low_stock_threshold' => $data['low_stock_threshold'] ?? 5,
            'is_active' => false, // brouillon : invisible sur le site tant qu'il n'est pas publié
            'is_featured' => false,
        ]);

        return response()->json(['data' => CatalogAdminController::row($product->fresh(['category', 'brand', 'images']))], 201);
    }

    public function brands(): JsonResponse
    {
        return response()->json(['data' => Brand::query()->where('is_active', true)->orderByDesc('is_house_brand')->orderBy('name')
            ->get(['id', 'name', 'is_house_brand'])]);
    }

    public function storeBrand(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'min:2', 'max:80']], [], ['name' => 'nom de la marque']);
        $name = trim($data['name']);
        $slug = Str::slug($name);
        if ($slug === '' || Brand::query()->where('slug', $slug)->exists()) {
            throw ValidationException::withMessages(['name' => 'Cette marque existe déjà.']);
        }
        $brand = Brand::create(['name' => $name, 'slug' => $slug, 'is_house_brand' => false, 'is_active' => true]);
        activity('products')->performedOn($brand)->causedBy($request->user())->event('created')->log('brand created');

        return response()->json(['data' => $brand->only(['id', 'name', 'is_house_brand'])], 201);
    }

    /** Catégories où ranger un produit : celles sans sous-catégorie (Sérums, Soins traitants…) */
    public function categories(): JsonResponse
    {
        $categories = Category::query()->where('is_active', true)->whereDoesntHave('children')->orderBy('position')->get(['id', 'name']);

        return response()->json(['data' => $categories]);
    }

    public function storeImage(Request $request, Product $product, ProductImageService $images): JsonResponse
    {
        // Le navigateur réduit la photo avant l'envoi (2000 px) : 2 Mo suffisent largement
        $request->validate(['image' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:2048', 'dimensions:min_width=400,min_height=400']], [
            'image.max' => 'La photo dépasse 2 Mo.',
            'image.dimensions' => 'La photo est trop petite : 400 × 400 pixels au minimum.',
            'image.mimes' => 'Formats acceptés : JPG, PNG ou WebP.',
        ]);
        $image = $images->add($product, $request->file('image'));
        activity('products')->performedOn($product)->causedBy($request->user())->withProperties(['path' => $image->path])->event('image_added')->log('image added');

        return response()->json(['data' => CatalogAdminController::row($product->fresh(['category', 'brand', 'images']))], 201);
    }

    public function destroyImage(Request $request, Product $product, ProductImage $image, ProductImageService $images): JsonResponse
    {
        $images->remove($product, $image);
        activity('products')->performedOn($product)->causedBy($request->user())->withProperties(['path' => $image->path])->event('image_removed')->log('image removed');

        return response()->json(['data' => CatalogAdminController::row($product->fresh(['category', 'brand', 'images']))]);
    }

    public function primaryImage(Product $product, ProductImage $image, ProductImageService $images): JsonResponse
    {
        $images->makePrimary($product, $image);

        return response()->json(['data' => CatalogAdminController::row($product->fresh(['category', 'brand', 'images']))]);
    }

    /** Référence lisible : marque (DAB, VHF), 3 lettres du nom, numéro. Ex. « VHF-HUI-001 » */
    private function uniqueSku(Brand $brand, string $name, ?string $size): string
    {
        $brandCode = $brand->is_house_brand ? 'DAB' : $this->code($brand->name);
        $nameCode = substr(strtoupper(Str::of(Str::ascii($name))->replaceMatches('/[^A-Za-z]/', '')->toString()).'XXX', 0, 3);
        for ($n = 1; ; $n++) {
            $sku = sprintf('%s-%s-%03d', $brandCode, $nameCode, $n);
            if (! Product::withTrashed()->where('sku', $sku)->exists()) {
                return $sku;
            }
        }
    }

    /** « Virgin Hair Fertilizer » -> « VHF » ; « Shea » -> « SHE » */
    private function code(string $name): string
    {
        $words = array_values(array_filter(preg_split('/[^A-Za-z0-9]+/', Str::ascii($name)) ?: []));
        $code = count($words) >= 2 ? implode('', array_map(fn ($w) => $w[0], array_slice($words, 0, 3))) : ($words[0] ?? 'PRD');

        return substr(strtoupper($code).'XXX', 0, 3);
    }

    private function uniqueSlug(string $label): string
    {
        $base = Str::slug($label) ?: 'produit';
        $slug = $base;
        for ($n = 2; Product::withTrashed()->where('slug', $slug)->exists(); $n++) {
            $slug = "{$base}-{$n}";
        }

        return $slug;
    }
}
