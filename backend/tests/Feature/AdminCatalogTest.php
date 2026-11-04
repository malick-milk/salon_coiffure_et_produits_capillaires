<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** ERP, catalogue : les listes du personnel (coût de revient visible) et les cas limites du stock */
class AdminCatalogTest extends TestCase
{
    use RefreshDatabase;

    private function sku(string $sku): Product
    {
        return Product::where('sku', $sku)->first();
    }

    public function test_la_liste_du_personnel_montre_le_cout_de_revient_et_la_marge(): void
    {
        $this->actingAs(tap(User::factory()->create())->assignRole('cashier'));
        $row = collect($this->getJson('/api/v1/admin/products')->assertOk()->json('data'))->firstWhere('sku', 'DAB-SBO-030');
        $this->assertEquals(266.67, $row['cost_price']);   // jamais exposé sur l'API publique
        $this->assertEquals(91.1, $row['margin_rate']);    // (3 000 − 266,67) ÷ 3 000
        $this->assertSame(60, $row['stock_quantity']);

        $unknown = collect($this->getJson('/api/v1/admin/products')->json('data'))->firstWhere('sku', 'DAB-SAP-015');
        $this->assertNull($unknown['cost_price']);
        $this->assertNull($unknown['margin_rate']);        // coût inconnu : pas de marge inventée
    }

    public function test_le_grand_livre_d_un_produit_se_lit_du_plus_recent_au_plus_ancien(): void
    {
        $this->actingAs(tap(User::factory()->create())->assignRole('stock_keeper'));
        $creme = $this->sku('DAB-CRE-001');
        $rows = $this->getJson("/api/v1/admin/products/{$creme->id}/movements")->assertOk()->json('data');
        $this->assertSame(['sale', 'production'], array_column($rows, 'type'));
        $this->assertSame([0, 96], array_column($rows, 'stock_after'));
        $this->assertSame('Order #'.Order::where('reference', 'CMD-2026-000009')->value('id'), $rows[0]['reference']);
    }

    public function test_une_perte_superieure_au_stock_est_refusee_sans_rien_ecrire(): void
    {
        $this->actingAs(User::where('email', 'admin@dabohair.test')->first());
        $masque = $this->sku('DAB-MAS-001'); // 24 en stock
        $movements = $masque->stockMovements()->count();
        $this->postJson("/api/v1/admin/products/{$masque->id}/stock-adjustments", ['type' => 'loss', 'quantity' => 30, 'reason' => 'Inventaire'])
            ->assertStatus(409)->assertJsonPath('items.0.available', 24)->assertJsonPath('items.0.requested', 30);
        $this->assertSame(24, $masque->fresh()->stock_quantity);
        $this->assertSame($movements, $masque->stockMovements()->count()); // aucun mouvement écrit
    }

    public function test_un_ajustement_d_inventaire_peut_ajouter_ou_retirer_et_un_retour_ajoute_toujours(): void
    {
        $this->actingAs(User::where('email', 'admin@dabohair.test')->first());
        $spray = $this->sku('DAB-SPH-250'); // 48
        $url = "/api/v1/admin/products/{$spray->id}/stock-adjustments";
        $this->postJson($url, ['type' => 'adjustment', 'quantity' => -3, 'reason' => 'Écart d’inventaire'])->assertCreated()->assertJsonPath('data.stock_quantity', 45);
        $this->postJson($url, ['type' => 'adjustment', 'quantity' => 1, 'reason' => 'Flacon retrouvé'])->assertCreated()->assertJsonPath('data.stock_quantity', 46);
        $this->postJson($url, ['type' => 'customer_return', 'quantity' => -2, 'reason' => 'Retour intact'])->assertCreated()->assertJsonPath('data.stock_quantity', 48); // −2 saisi -> +2
        $this->postJson($url, ['type' => 'sale', 'quantity' => -1, 'reason' => 'Vente'])->assertUnprocessable(); // une vente passe par une commande
        $this->postJson($url, ['type' => 'adjustment', 'quantity' => 0, 'reason' => 'Rien'])->assertUnprocessable();
    }

    public function test_liste_des_lots_avec_rentabilite_potentielle(): void
    {
        $this->actingAs(tap(User::factory()->create())->assignRole('stock_keeper'));
        $lots = collect($this->getJson('/api/v1/admin/production-batches')->assertOk()->json('data'));
        $sbo = $lots->firstWhere('batch_number', 'LOT-2603-SBO-030');
        $this->assertSame($sbo['quantity_produced'] * 3000, $sbo['potential_revenue']); // si tout le lot est vendu au prix public
        $this->assertSame($sbo['potential_revenue'] - $sbo['total_cost'], $sbo['potential_margin']);
        $this->assertNull($lots->firstWhere('batch_number', 'LOT-2603-SAC-001')['potential_margin']); // coût inconnu
        $this->postJson('/api/v1/admin/production-batches', [])->assertUnprocessable(); // le magasinier fabrique (production.manage)

        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->actingAs(tap(User::factory()->create())->assignRole('cashier'), 'web');
        $this->getJson('/api/v1/admin/production-batches')->assertOk();                 // le caissier consulte (stock.view)…
        $this->postJson('/api/v1/admin/production-batches', [])->assertForbidden();     // … mais ne fabrique pas
    }

    public function test_prix_barre_doit_etre_superieur_au_prix_et_seul_products_manage_modifie(): void
    {
        $serum = $this->sku('DAB-SAP-030');
        $this->actingAs(tap(User::factory()->create())->assignRole('cashier'));
        $this->patchJson("/api/v1/admin/products/{$serum->id}", ['price' => 1])->assertForbidden();

        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->actingAs(User::where('email', 'admin@dabohair.test')->first(), 'web');
        $this->patchJson("/api/v1/admin/products/{$serum->id}", ['compare_at_price' => 2500])
            ->assertJsonPath('errors.compare_at_price.0', 'Le prix barré doit être supérieur au prix de vente (3000 F).');
        $this->patchJson("/api/v1/admin/products/{$serum->id}", ['compare_at_price' => 3500])->assertOk() // prix barré SEUL
            ->assertJsonPath('data.compare_at_price', 3500);
        $this->patchJson("/api/v1/admin/products/{$serum->id}", ['price' => 4000])->assertUnprocessable(); // dépasserait le prix barré
        $this->patchJson("/api/v1/admin/products/{$serum->id}", ['price' => 4000, 'compare_at_price' => null])->assertOk(); // fin de la promo
    }
}
