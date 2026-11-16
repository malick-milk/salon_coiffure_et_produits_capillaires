<?php

namespace App\Models;

use App\Enums\ProductOrigin;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Produit. RÈGLE : stock_quantity ne se modifie JAMAIS directement, uniquement via
 * App\Services\Inventory\StockService (grand livre stock_movements, ADR-006).
 *
 * Types des colonnes converties (casts) : déclarés pour l'analyse statique (Larastan).
 *
 * @property int $price
 * @property int|null $compare_at_price
 * @property string|null $cost_price
 * @property int $stock_quantity
 * @property int $low_stock_threshold
 * @property bool $is_active
 * @property bool $is_featured
 * @property ProductOrigin $origin
 */
class Product extends Model
{
    use LogsActivity, SoftDeletes;

    // stock_quantity est volontairement ABSENT : impossible de le modifier par « mass assignment »
    protected $fillable = [
        'category_id', 'brand_id', 'variant_of_id', 'origin', 'sku', 'name', 'slug', 'short_description', 'description',
        'unit_size', 'price', 'compare_at_price', 'cost_price', 'low_stock_threshold', 'is_active', 'is_featured',
        'meta_title', 'meta_description',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'compare_at_price' => 'integer',
            'cost_price' => 'decimal:2',
            'stock_quantity' => 'integer',
            'low_stock_threshold' => 'integer',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
            'origin' => ProductOrigin::class,
        ];
    }

    /** @return BelongsTo<Category, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /** @return BelongsTo<Brand, $this> */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    // Nom de la table pivot explicite : Laravel devinerait « hair_type_product » (ordre alphabétique)
    /** @return BelongsToMany<HairType, $this> */
    public function hairTypes(): BelongsToMany
    {
        return $this->belongsToMany(HairType::class, 'product_hair_type');
    }

    /** @return HasMany<PurchaseReceipt, $this> */
    public function purchaseReceipts(): HasMany
    {
        return $this->hasMany(PurchaseReceipt::class);
    }

    /** @return HasMany<ProductImage, $this> */
    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('position');
    }

    /** @return HasMany<StockMovement, $this> */
    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function mainProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'variant_of_id');
    }

    /** @return HasMany<Product, $this> */
    public function variants(): HasMany
    {
        return $this->hasMany(Product::class, 'variant_of_id');
    }

    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /** Le statut public du stock (le chiffre exact n'est jamais exposé) */
    public function stockStatus(): string
    {
        return match (true) {
            $this->stock_quantity === 0 => 'out_of_stock',
            $this->stock_quantity <= $this->low_stock_threshold => 'low_stock',
            default => 'in_stock',
        };
    }

    public function displayName(): string
    {
        return trim($this->name.' '.($this->unit_size ?? ''));
    }

    /** Journal d'audit (RG-SEC-01) : qui a modifié quoi, avec les valeurs avant et après */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('products')->logOnly(['name', 'price', 'compare_at_price', 'cost_price', 'is_active', 'is_featured', 'low_stock_threshold', 'description'])->logOnlyDirty()->dontSubmitEmptyLogs();
    }
}
