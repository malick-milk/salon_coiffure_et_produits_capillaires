<?php

namespace Database\Seeders;

use App\Enums\CustomerType;
use App\Enums\FulfillmentMethod;
use App\Enums\OrderChannel;
use App\Enums\OrderStatus;
use App\Enums\ProductionCostCategory;
use App\Enums\StockMovementType;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductionBatch;
use App\Services\Inventory\StockService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * CATALOGUE RÉEL DABO HAIR (docs/03b §5) : prix de vente, lots de fabrication, coûts « Achat »
 * et la vente en gros de 1 374 000 F CFA. Tout le stock passe par le StockService (grand livre).
 */
class DaboHairCatalogSeeder extends Seeder
{
    /** Photos des produits, reçues le 10 novembre 2026 (recadrées en 4:5, WebP 800 × 1000) */
    private const PHOTOS = [
        'DAB-MAS-001' => [['masque-capillaire-1.webp', 'Pot de masque capillaire Dabo Hair, étiquette noire et or'], ['masque-capillaire-2.webp', 'Masque capillaire Dabo Hair vu de côté']],
        'DAB-SPH-250' => [['spray-hydratant-1.webp', 'Flacon de spray hydratant Dabo Hair 250 ml'], ['spray-hydratant-2.webp', 'Spray hydratant Dabo Hair : couleur du produit']],
        'DAB-SHA-001' => [['shampooing-1.webp', 'Flacon de shampooing sans sulfate Dabo Hair']],
    ];

    public function run(StockService $stock): void
    {
        $root = Category::updateOrCreate(['slug' => 'soins-capillaires'], ['name' => 'Soins capillaires', 'position' => 1]);
        $cat = [];
        foreach ([['serums', 'Sérums', 1], ['hydratants-et-cremes', 'Hydratants et crèmes', 2], ['soins-traitants', 'Soins traitants', 3], ['shampoings', 'Shampoings', 4]] as [$slug, $name, $pos]) {
            $cat[$slug] = Category::updateOrCreate(['slug' => $slug], ['name' => $name, 'parent_id' => $root->id, 'position' => $pos]);
        }
        $dabo = Brand::updateOrCreate(['slug' => 'dabo-hair'], ['name' => 'Dabo Hair', 'is_house_brand' => true]);

        // [sku, nom, slug, contenance, prix, catégorie, phare, seuil, lot : quantité, coût total (null = inconnu), lot réel ?]
        $catalog = [
            ['DAB-SAP-030', 'Sérum Activ’Pousse', 'serum-activ-pousse-30-ml', '30 ml', 3000, 'serums', true, 12, 96, 25600],
            ['DAB-SAP-015', 'Sérum Activ’Pousse', 'serum-activ-pousse-15-ml', '15 ml', 1500, 'serums', false, 6, 48, null],
            ['DAB-SBO-030', 'Sérum Booster', 'serum-booster-30-ml', '30 ml', 3000, 'serums', false, 6, 96, 25600],
            ['DAB-SPH-250', 'Spray hydratant', 'spray-hydratant-250-ml', '250 ml', 5000, 'hydratants-et-cremes', true, 12, 96, 33600],
            ['DAB-HYD-100', 'Hydratant', 'hydratant-100-ml', '100 ml', 2500, 'hydratants-et-cremes', false, 12, 84, null],
            ['DAB-CRE-001', 'Crème capillaire', 'creme-capillaire', null, 3000, 'hydratants-et-cremes', true, 12, 96, 14400],
            ['DAB-SAC-001', 'Spray anti-chute', 'spray-anti-chute', null, 5000, 'soins-traitants', false, 6, 96, null],
            ['DAB-MAS-001', 'Masque capillaire', 'masque-capillaire', null, 3000, 'soins-traitants', false, 6, 48, 18400],
            ['DAB-SHA-001', 'Shampooing sans sulfate', 'shampooing-sans-sulfate', null, 3000, 'shampoings', true, 12, 96, 38400],
        ];

        $products = [];
        foreach ($catalog as [$sku, $name, $slug, $size, $price, $category, $featured, $threshold, $qty, $cost]) {
            $product = Product::updateOrCreate(['sku' => $sku], [
                'name' => $name, 'slug' => $slug, 'unit_size' => $size, 'price' => $price, 'category_id' => $cat[$category]->id,
                'brand_id' => $dabo->id, 'is_featured' => $featured, 'low_stock_threshold' => $threshold,
            ]);
            $products[$sku] = $product;

            // Photos réelles (frontend/public/images/produits/) : la première est l'image principale
            foreach (self::PHOTOS[$sku] ?? [] as $i => [$file, $alt]) {
                ProductImage::updateOrCreate(['product_id' => $product->id, 'path' => "/images/produits/{$file}"], [
                    'alt_text' => $alt, 'position' => $i, 'is_primary' => $i === 0,
                ]);
            }

            if ($product->stockMovements()->exists()) {
                continue; // seeder relancé : on ne refabrique pas
            }
            $batch = ProductionBatch::create([
                'batch_number' => 'LOT-2603-'.substr($sku, 4),
                'product_id' => $product->id,
                'quantity_produced' => $qty,
                'total_cost' => $cost,
                'produced_on' => '2026-03-20',
                'expires_on' => $sku === 'DAB-MAS-001' ? '2026-09-30' : '2027-09-20',
                'notes' => $cost === null ? 'Coût et/ou quantité à compléter' : intdiv($qty, 12).' douzaines',
            ]);
            if ($cost !== null) {
                $batch->costs()->create(['category' => ProductionCostCategory::Other, 'label' => 'Achat (calcul des bénéfices)', 'amount' => $cost, 'spent_on' => '2026-03-20']);
                $product->update(['cost_price' => $batch->refresh()->unit_cost]); // coût unitaire calculé par MySQL
            }
            // Le mouvement est daté du jour de fabrication, pas du jour où l'on remplit la base :
            // l'historique du stock (étape 8) se reconstruit à partir de ces dates
            Carbon::setTestNow('2026-03-20 08:00:00');
            $stock->record($product, StockMovementType::Production, $qty, $batch, "Fabrication {$batch->batch_number}", unitCost: $cost ? (int) round($cost / $qty) : null);
            Carbon::setTestNow();
        }
        $products['DAB-SAP-015']->update(['variant_of_id' => $products['DAB-SAP-030']->id]);

        // Vente en gros RÉELLE (capture du client) : 36 douzaines, 1 374 000 F CFA.
        // PAS en production : le nom du revendeur n'est pas encore renseigné ([REVENDEUR] [NOM]) ; le stock réel
        // se saisit le premier jour par un inventaire dans l'ERP (docs/11_DEPLOIEMENT.md, « Jour 1 »).
        if (app()->isProduction() || Order::where('reference', 'CMD-2026-000009')->exists()) {
            return;
        }
        $reseller = Customer::updateOrCreate(['phone' => '770000099'], [
            'customer_type' => CustomerType::Reseller, 'first_name' => '[REVENDEUR]', 'last_name' => '[NOM]', 'notes' => 'Commandes à la douzaine.',
        ]);
        $lines = ['DAB-SHA-001' => 48, 'DAB-SPH-250' => 48, 'DAB-HYD-100' => 60, 'DAB-CRE-001' => 96, 'DAB-SAP-030' => 72, 'DAB-SAP-015' => 24, 'DAB-SAC-001' => 24, 'DAB-MAS-001' => 24, 'DAB-SBO-030' => 36];
        $subtotal = collect($lines)->map(fn ($q, $sku) => $products[$sku]->price * $q)->sum();
        $order = Order::create([
            'reference' => 'CMD-2026-000009', 'customer_id' => $reseller->id, 'channel' => OrderChannel::Store, 'status' => OrderStatus::Confirmed,
            'fulfillment_method' => FulfillmentMethod::Pickup, 'subtotal' => $subtotal, 'total' => $subtotal,
            'customer_notes' => 'Commande en gros (douzaines)', 'placed_at' => '2026-03-24 09:30:00', 'confirmed_at' => '2026-03-24 10:00:00',
        ]);
        foreach ($lines as $sku => $qty) {
            $p = $products[$sku];
            $order->items()->create(['product_id' => $p->id, 'product_name' => $p->displayName(), 'sku' => $sku, 'unit_price' => $p->price, 'unit_cost' => $p->cost_price, 'quantity' => $qty, 'line_total' => $p->price * $qty]);
            Carbon::setTestNow('2026-03-24 09:30:00'); // sortie de stock à la date de la commande
            $stock->record($p, StockMovementType::Sale, -$qty, $order);
            Carbon::setTestNow();
        }
    }
}
