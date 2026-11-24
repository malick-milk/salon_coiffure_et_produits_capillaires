<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Créer une gamme depuis l'ERP (maquette « Nouvelle gamme », validée le 24 novembre 2026) */
class BundleCreationTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsRole(string $role): void
    {
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->actingAs(tap(User::factory()->create())->assignRole($role));
    }

    private function id(string $sku): int
    {
        return Product::where('sku', $sku)->value('id');
    }

    /** L'exemple de la maquette, avec le sérum Booster à la place de la crème (en rupture dans les données de démonstration) */
    private function avocado(array $over = []): array
    {
        return [
            'name' => 'Gamme à l’avocat', 'price' => 12000, 'member_price' => 10000, 'member_price_limit' => 200, 'low_stock_threshold' => 10,
            'short_description' => 'Quatre soins à l’avocat.',
            'items' => [
                ['product_id' => $this->id('DAB-SHA-001'), 'quantity' => 1], ['product_id' => $this->id('DAB-MAS-001'), 'quantity' => 1],
                ['product_id' => $this->id('DAB-SBO-030'), 'quantity' => 1], ['product_id' => $this->id('DAB-SPH-250'), 'quantity' => 1],
            ],
            ...$over,
        ];
    }

    private function create(array $over = []): TestResponse
    {
        return $this->postJson('/api/v1/admin/bundles', $this->avocado($over));
    }

    public function test_la_gerante_cree_une_gamme_en_brouillon_avec_sa_composition(): void
    {
        $this->actingAsRole('manager');
        $res = $this->create()->assertCreated()
            ->assertJsonPath('data.is_bundle', true)->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.sku', 'DAB-GAM-002')->assertJsonPath('data.slug', 'gamme-a-l-avocat')
            ->assertJsonPath('data.unit_size', '4 soins')->assertJsonPath('data.category', 'Gammes')
            ->assertJsonPath('data.member_price', 10000)->assertJsonPath('data.member_price_limit', 200)
            // Coût = celui de ses produits : 400 + 383,33 + 266,67 + 350 = 1 400 F ; marge (12 000 − 1 400) ÷ 12 000 = 88,3 %
            ->assertJsonPath('data.cost_price', 1400)->assertJsonPath('data.margin_rate', 88.3);

        $bundle = Product::with('bundleItems.component')->findOrFail($res->json('data.id'));
        $this->assertCount(4, $bundle->bundleItems);
        // Le stock d'une gamme = le produit le plus rare de sa composition
        $min = $bundle->bundleItems->map(fn ($i) => intdiv($i->component->stock_quantity, $i->quantity))->min();
        $this->assertSame($min, $res->json('data.stock_quantity'));
        $this->assertDatabaseHas('activity_log', ['log_name' => 'products', 'subject_id' => $bundle->id, 'event' => 'created']);
    }

    public function test_les_regles_de_composition_et_de_prix(): void
    {
        $this->actingAsRole('manager');
        $sha = $this->id('DAB-SHA-001');
        $this->create(['items' => [['product_id' => $sha, 'quantity' => 1]]])->assertJsonValidationErrors(['items' => 'au moins 2 produits']);
        $this->create(['items' => [['product_id' => $sha, 'quantity' => 1], ['product_id' => $sha, 'quantity' => 2]]])
            ->assertJsonValidationErrors(['items.1.product_id' => 'déjà dans la gamme']);
        // Une gamme ne peut pas contenir une autre gamme
        $this->create(['items' => [['product_id' => $sha, 'quantity' => 1], ['product_id' => $this->id('DAB-GAM-001'), 'quantity' => 1]]])
            ->assertJsonValidationErrors(['items.1.product_id' => 'lui-même une gamme']);
        $this->create(['member_price' => 12000])->assertJsonValidationErrors(['member_price' => 'inférieur au prix de la gamme']);
        $this->create(['member_price_limit' => null])->assertJsonValidationErrors('member_price_limit');
        $this->create(['name' => 'Gamme complète Dabo Hair'])->assertJsonValidationErrors(['name' => 'déjà ce nom']);
        // Sans prix membre : pas de limite enregistrée
        $this->create(['member_price' => null, 'member_price_limit' => 50])->assertCreated()->assertJsonPath('data.member_price_limit', null);
    }

    public function test_droits_seuls_ceux_qui_gerent_les_produits_creent_une_gamme(): void
    {
        $this->postJson('/api/v1/admin/bundles', [])->assertUnauthorized();
        $this->actingAsRole('cashier');
        $this->create()->assertForbidden();
        $this->assertFalse(Product::where('name', 'Gamme à l’avocat')->exists());
    }

    public function test_publiee_avec_une_photo_elle_se_vend_et_retire_chaque_produit_du_stock(): void
    {
        Storage::fake('public');
        $this->actingAsRole('manager');
        $id = $this->create()->assertCreated()->json('data.id');
        $this->patchJson("/api/v1/admin/products/{$id}", ['is_active' => true])->assertJsonValidationErrors(['is_active' => 'photo']);
        $this->post("/api/v1/admin/products/{$id}/images", ['image' => UploadedFile::fake()->image('gamme.jpg', 1200, 1200)], ['Accept' => 'application/json'])->assertCreated();
        $this->patchJson("/api/v1/admin/products/{$id}", ['is_active' => true])->assertOk()->assertJsonPath('data.is_active', true);

        $before = Product::whereIn('sku', ['DAB-SHA-001', 'DAB-MAS-001', 'DAB-SBO-030', 'DAB-SPH-250'])->pluck('stock_quantity', 'sku');
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/products/gamme-a-l-avocat')->assertOk()->assertJsonPath('data.price', 12000);
        $this->postJson('/api/v1/orders', [
            'items' => [['product_id' => $id, 'quantity' => 1]], 'fulfillment_method' => 'pickup',
            'customer' => ['first_name' => 'Awa', 'last_name' => 'Diop', 'phone' => '77 123 45 67', 'email' => null], 'notes' => null, 'consent' => true,
        ])->assertCreated()->assertJsonPath('data.total', 12000); // sans compte : prix normal

        foreach ($before as $sku => $stock) {
            $this->assertSame($stock - 1, Product::where('sku', $sku)->value('stock_quantity'), "$sku : une gamme vendue retire 1 produit");
        }
    }
}
