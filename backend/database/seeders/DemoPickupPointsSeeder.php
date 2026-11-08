<?php

namespace Database\Seeders;

use App\Enums\StockMovementType;
use App\Models\PickupPoint;
use App\Models\Product;
use App\Models\User;
use App\Services\Inventory\StockService;
use App\Services\PickupPoints\PickupPointService;
use Illuminate\Database\Seeder;

/**
 * Points de retrait de DÉMONSTRATION (étape 14) — uniquement en local.
 * Casamance (un partenaire pour Ziguinchor, Sédhiou et Kolda) et Thiès, avec une livraison chacun.
 */
class DemoPickupPointsSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            return;
        }
        $admin = User::where('email', 'admin@dabohair.test')->first();
        $service = app(PickupPointService::class);
        $stock = app(StockService::class);
        $points = [
            ['name' => 'Boutique Awa Cosmétiques', 'owner_name' => 'Awa Badji', 'phone' => '761234510', 'regions' => ['Ziguinchor', 'Sédhiou', 'Kolda'], 'city' => 'Ziguinchor', 'address' => 'Quartier Boucotte, près du marché', 'opening_hours' => 'Lundi au samedi, 9 h – 19 h'],
            ['name' => 'Boutique de Moussa Diop', 'owner_name' => 'Moussa Diop', 'phone' => '771231234', 'regions' => ['Thiès'], 'city' => 'Thiès', 'address' => 'Marché central, allée des cosmétiques', 'opening_hours' => 'Lundi au samedi, 9 h – 19 h'],
        ];
        $skus = ['DAB-SAP-030' => 12, 'DAB-SHA-001' => 6, 'DAB-SPH-250' => 6, 'DAB-MAS-001' => 6]; // la crème est en rupture dans la démo
        $products = Product::whereIn('sku', array_keys($skus))->pluck('id', 'sku');
        foreach ($points as $data) {
            $point = PickupPoint::updateOrCreate(['phone' => $data['phone']], $data);
            if (! $point->deliveries()->exists() && $admin) {
                // Démo : un lot fabriqué exprès pour le partenaire, pour ne pas changer le stock du salon
                // (les parcours automatiques comptent sur les quantités de départ)
                foreach ($skus as $sku => $qty) {
                    $stock->record(Product::findOrFail($products[$sku]), StockMovementType::Production, $qty, reason: "Lot démo pour {$point->name}", userId: $admin->id);
                }
                $service->deliver($point, collect($skus)->mapWithKeys(fn ($qty, $sku) => [$products[$sku] => $qty])->all(), $admin);
            }
        }
    }
}
