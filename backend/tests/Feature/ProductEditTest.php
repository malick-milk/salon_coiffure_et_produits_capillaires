<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Modifier un produit existant (maquette « Modifier un produit », validée le 18 novembre 2026) */
class ProductEditTest extends TestCase
{
    use RefreshDatabase;

    private function admin(string $role = 'super_admin'): User
    {
        $user = tap(User::factory()->create())->assignRole($role);
        $this->actingAs($user);

        return $user;
    }

    /** Un produit revendu tout neuf : coût 2 500 F, prix 6 000 F, aucune réception encore */
    private function newResold(array $over = []): int
    {
        $brand = Brand::firstOrCreate(['slug' => 'virgin-hair-fertilizer'], ['name' => 'Virgin Hair Fertilizer', 'is_house_brand' => false, 'is_active' => true]);

        return $this->postJson('/api/v1/admin/products', [
            'origin' => 'resold', 'name' => 'Huile de croissance', 'brand_id' => $brand->id, 'unit_size' => '120 ml',
            'category_id' => Category::where('slug', 'soins-traitants')->value('id'), 'price' => 6000, 'purchase_price' => 2500, ...$over,
        ])->assertCreated()->json('data.id');
    }

    private function receive(int $id, int $quantity, int $unitPrice): void
    {
        $this->postJson('/api/v1/admin/purchase-receipts', ['product_id' => $id, 'supplier_name' => 'Grossiste Sandaga', 'received_on' => now()->toDateString(),
            'quantity' => $quantity, 'unit_price' => $unitPrice])->assertCreated();
    }

    public function test_la_fiche_se_modifie_mais_la_reference_et_l_adresse_ne_changent_jamais(): void
    {
        $this->admin();
        $id = $this->newResold();
        $product = Product::find($id);

        $row = $this->patchJson("/api/v1/admin/products/{$id}", [
            'name' => '  Huile de pousse ', 'unit_size' => '250 ml', 'category_id' => Category::where('slug', 'serums')->value('id') ?? $product->category_id,
            'low_stock_threshold' => 8, 'short_description' => 'Fait pousser les cheveux.', 'sku' => 'PIRATE-001', 'slug' => 'pirate',
        ])->assertOk()->json('data');

        $this->assertSame(['Huile de pousse', '250 ml', 8, 'Fait pousser les cheveux.'], [$row['name'], $row['unit_size'], $row['low_stock_threshold'], $row['short_description']]);
        // Envoyés quand même : ignorés (ni validés, ni modifiables)
        $this->assertSame([$product->sku, $product->slug], [$row['sku'], $row['slug']]);
    }

    public function test_avant_toute_reception_l_origine_et_le_cout_se_corrigent(): void
    {
        $this->admin();
        $id = $this->newResold();

        $row = $this->patchJson("/api/v1/admin/products/{$id}", ['origin' => 'made', 'cost_price' => 2000])->assertOk()->json('data');

        $this->assertEquals(['made', 2000, false], [$row['origin'], $row['cost_price'], $row['stock_entries_locked']]);
        $this->assertEqualsWithDelta(66.7, $row['margin_rate'], 0.01); // (6 000 − 2 000) ÷ 6 000
    }

    public function test_apres_une_reception_l_origine_et_le_cout_sont_verrouilles(): void
    {
        $this->admin();
        $id = $this->newResold();
        $this->receive($id, 10, 2750);

        $this->assertTrue($this->getJson('/api/v1/admin/products')->assertOk()->collect('data')->firstWhere('id', $id)['stock_entries_locked']);
        $this->patchJson("/api/v1/admin/products/{$id}", ['origin' => 'made'])->assertUnprocessable()
            ->assertJsonPath('errors.origin.0', "L'origine ne peut plus changer : du stock est déjà entré par un lot fabriqué ou une réception d'achat.");
        $this->patchJson("/api/v1/admin/products/{$id}", ['cost_price' => 1000])->assertUnprocessable()->assertJsonValidationErrors(['cost_price']);

        // Le formulaire renvoie les valeurs actuelles : acceptées, rien ne change
        $row = $this->patchJson("/api/v1/admin/products/{$id}", ['origin' => 'resold', 'cost_price' => 2750, 'price' => 6500])->assertOk()->json('data');
        $this->assertEquals([6500, 2750, 57.7], [$row['price'], $row['cost_price'], $row['margin_rate']]);
    }

    public function test_un_lot_fabrique_verrouille_aussi_un_produit_dabo_hair(): void
    {
        $this->admin();
        $made = Product::where('sku', 'DAB-SHA-001')->value('id');
        $this->postJson('/api/v1/admin/production-batches', ['product_id' => $made, 'batch_number' => 'LOT-EDIT-1', 'quantity_produced' => 12, 'produced_on' => now()->toDateString()])->assertCreated();

        $this->patchJson("/api/v1/admin/products/{$made}", ['origin' => 'resold'])->assertUnprocessable()->assertJsonValidationErrors(['origin']);
    }

    public function test_pas_de_doublon_mais_garder_son_propre_nom_est_permis(): void
    {
        $this->admin();
        $huile = $this->newResold();
        $autre = $this->newResold(['name' => 'Shampoing fortifiant']);

        $this->patchJson("/api/v1/admin/products/{$autre}", ['name' => 'Huile de croissance'])->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'Un autre produit porte déjà ce nom, dans cette marque et cette contenance.');
        $this->patchJson("/api/v1/admin/products/{$autre}", ['name' => 'Huile de croissance', 'unit_size' => '250 ml'])->assertOk(); // autre contenance : permis
        $this->patchJson("/api/v1/admin/products/{$huile}", ['name' => 'Huile de croissance', 'price' => 6200])->assertOk();
    }

    public function test_changer_le_prix_ne_touche_pas_aux_commandes_passees(): void
    {
        $this->admin();
        $spray = Product::where('sku', 'DAB-SPH-250')->first();
        $this->postJson('/api/v1/orders', [
            'items' => [['product_id' => $spray->id, 'quantity' => 1]], 'fulfillment_method' => 'pickup', 'delivery_zone_id' => null,
            'customer' => ['first_name' => 'Khady', 'last_name' => 'Fall', 'phone' => '76 111 22 33', 'email' => null], 'shipping_address' => null, 'notes' => null, 'consent' => true,
        ])->assertCreated();

        $this->patchJson("/api/v1/admin/products/{$spray->id}", ['price' => $spray->price + 1000])->assertOk();

        $this->assertSame($spray->price, OrderItem::where('product_id', $spray->id)->latest('id')->value('unit_price'));
    }

    public function test_chaque_modification_va_au_journal_et_dans_les_dernieres_modifications(): void
    {
        $admin = $this->admin();
        $id = $this->newResold();
        $this->patchJson("/api/v1/admin/products/{$id}", ['price' => 6500, 'short_description' => 'Pousse et brillance.'])->assertOk();

        $history = $this->getJson("/api/v1/admin/products/{$id}/history")->assertOk()->json('data');

        $this->assertSame(['updated', trim($admin->first_name.' '.$admin->last_name)], [$history[0]['event'], $history[0]['causer']]);
        $changes = collect($history[0]['changes'])->keyBy('field');
        $this->assertSame([6000, 6500], [$changes['price']['old'], $changes['price']['new']]);
        $this->assertSame('Pousse et brillance.', $changes['short_description']['new']);
        $this->assertSame('created', $history[1]['event']);
    }

    public function test_droits_le_caissier_voit_mais_ne_modifie_pas(): void
    {
        $this->admin();
        $id = $this->newResold();

        $this->admin('cashier');
        $this->patchJson("/api/v1/admin/products/{$id}", ['name' => 'Piraté'])->assertForbidden();
    }
}
