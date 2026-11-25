<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Fiche d'un produit seul : « Mieux en routine », LA gamme qui le contient (maquette validée le 25 novembre 2026) */
class BundleOfferTest extends TestCase
{
    use RefreshDatabase;

    private function bundle(string $name, int $price, array $skus): void
    {
        $this->actingAs(tap(User::factory()->create())->assignRole('manager'));
        $id = $this->postJson('/api/v1/admin/bundles', [
            'name' => $name, 'price' => $price,
            'items' => collect($skus)->map(fn ($s) => ['product_id' => Product::where('sku', $s)->value('id'), 'quantity' => 1])->all(),
        ])->assertCreated()->json('data.id');
        Product::whereKey($id)->update(['is_active' => true]); // publiée
        $this->app['auth']->forgetGuards();
    }

    public function test_la_fiche_propose_la_gamme_la_moins_chere_en_stock_avec_l_economie(): void
    {
        $this->bundle('Gamme au coco', 9000, ['DAB-SHA-001', 'DAB-SPH-250', 'DAB-SBO-030']);        // 3 000 + 5 000 + 3 000 = 11 000
        $this->bundle('Grande gamme', 13000, ['DAB-SHA-001', 'DAB-SPH-250', 'DAB-SBO-030', 'DAB-MAS-001']);

        $this->getJson('/api/v1/products/spray-hydratant-250-ml')->assertOk()
            ->assertJsonPath('data.in_bundle.name', 'Gamme au coco')
            ->assertJsonPath('data.in_bundle.price', 9000)
            ->assertJsonPath('data.in_bundle.separate_price', 11000)
            ->assertJsonPath('data.in_bundle.saving', 2000)
            ->assertJsonPath('data.in_bundle.contents.1', 'Spray hydratant 250 ml');
    }

    public function test_aucune_gamme_en_stock_ou_publiee_pas_de_proposition(): void
    {
        // La seule gamme de démonstration contient la crème, en rupture : elle n'est pas proposée
        $this->getJson('/api/v1/products/spray-hydratant-250-ml')->assertOk()->assertJsonPath('data.in_bundle', null);
        // Une gamme ne se propose pas elle-même
        $this->getJson('/api/v1/products/gamme-complete-dabo-hair')->assertOk()->assertJsonPath('data.in_bundle', null);
    }
}
