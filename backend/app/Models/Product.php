<?php

namespace App\Models;

use App\Enums\ProductOrigin;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
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
 * @property int|null $member_price
 * @property int|null $member_price_limit
 * @property bool $is_bundle
 * @property string|null $cost_price
 * @property int $stock_quantity
 * @property int $low_stock_threshold
 * @property bool $is_active
 * @property bool $is_featured
 * @property ProductOrigin $origin
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Product extends Model
{
    use LogsActivity, SoftDeletes;

    // stock_quantity est volontairement ABSENT : impossible de le modifier par « mass assignment »
    protected $fillable = [
        'category_id', 'brand_id', 'variant_of_id', 'origin', 'is_bundle', 'member_price', 'member_price_limit', 'sku', 'name', 'slug', 'short_description', 'description',
        'unit_size', 'price', 'compare_at_price', 'cost_price', 'low_stock_threshold', 'is_active', 'is_featured',
        'meta_title', 'meta_description',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'compare_at_price' => 'integer',
            'member_price' => 'integer',
            'member_price_limit' => 'integer',
            'is_bundle' => 'boolean',
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

    /** @return HasMany<ProductionBatch, $this> */
    public function productionBatches(): HasMany
    {
        return $this->hasMany(ProductionBatch::class);
    }

    /**
     * Le stock et le coût de ce produit viennent-ils déjà d'un lot fabriqué ou d'une réception d'achat ?
     * Si oui : l'origine est verrouillée et le coût de revient n'est plus saisi à la main (moyenne pondérée).
     * Utilise les compteurs chargés par withExists() quand ils sont là (liste de l'ERP : pas une requête par ligne).
     */
    public function hasStockEntries(): bool
    {
        $attributes = $this->getAttributes();
        $batches = array_key_exists('production_batches_exists', $attributes) ? (bool) $attributes['production_batches_exists'] : $this->productionBatches()->exists();
        $receipts = array_key_exists('purchase_receipts_exists', $attributes) ? (bool) $attributes['purchase_receipts_exists'] : $this->purchaseReceipts()->exists();

        return $batches || $receipts;
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
    /** @return HasMany<ProductBundleItem, $this> */
    public function bundleItems(): HasMany
    {
        return $this->hasMany(ProductBundleItem::class, 'bundle_id');
    }

    /**
     * Quantité vendable. Produit simple : son stock. GAMME : le nombre de gammes complètes qu'on peut
     * former avec le stock de ses composants (le composant le plus rare décide).
     */
    public function availableQuantity(): int
    {
        if (! $this->is_bundle) {
            return $this->stock_quantity;
        }
        $this->loadMissing('bundleItems.component'); // chargement explicite (pas de requête cachée dans une boucle)

        return (int) ($this->bundleItems->map(fn (ProductBundleItem $i) => intdiv(max(0, $i->component->stock_quantity), $i->quantity))->min() ?? 0);
    }

    public function stockStatus(): string
    {
        $available = $this->availableQuantity();

        return match (true) {
            $available === 0 => 'out_of_stock',
            $available <= $this->low_stock_threshold => 'low_stock',
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
        return LogOptions::defaults()->useLogName('products')->logOnly(['origin', 'name', 'member_price', 'member_price_limit', 'brand_id', 'category_id', 'unit_size', 'price', 'compare_at_price', 'cost_price', 'is_active', 'is_featured', 'low_stock_threshold', 'short_description', 'description'])->logOnlyDirty()->dontSubmitEmptyLogs();
    }
}
