<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** POST /orders : mêmes cas que frontend/src/mocks/orders.test.ts, plus la persistance et le stock */
class OrderApiTest extends TestCase
{
    use RefreshDatabase;

    private function id(string $sku): int
    {
        return Product::where('sku', $sku)->value('id');
    }

    private function payload(array $items, array $override = []): array
    {
        return array_replace([
            'items' => $items,
            'fulfillment_method' => 'pickup',
            'delivery_zone_id' => null,
            'customer' => ['first_name' => 'Khady', 'last_name' => 'Fall', 'phone' => '76 111 22 33', 'email' => null],
            'shipping_address' => null,
            'notes' => null,
            'consent' => true,
        ], $override);
    }

    public function test_livraison_prix_de_la_base_frais_de_zone_et_instantanes(): void
    {
        $response = $this->postJson('/api/v1/orders', $this->payload(
            // Le navigateur tente d'envoyer un prix : il est IGNORÉ (champ non validé, donc non utilisé)
            [['product_id' => $this->id('DAB-SAP-030'), 'quantity' => 2, 'price' => 1], ['product_id' => $this->id('DAB-SPH-250'), 'quantity' => 1]],
            ['fulfillment_method' => 'delivery', 'delivery_zone_id' => 1, 'shipping_address' => ['city' => 'Dakar', 'district' => 'Plateau', 'address_line' => 'Rue 10', 'landmark' => 'Pharmacie']],
        ))->assertCreated()
            ->assertJsonPath('data.reference', 'CMD-2026-000010')
            ->assertJsonPath('data.subtotal', 11000)
            ->assertJsonPath('data.shipping_fee', 1000)
            ->assertJsonPath('data.total', 12000)
            ->assertJsonPath('data.delivery_zone', 'Dakar Plateau')
            ->assertJsonPath('data.shipping_address.landmark', 'Pharmacie')
            ->assertJsonPath('data.items_count', 3)
            ->assertJsonMissingPath('data.items.0.unit_cost');

        $order = Order::where('reference', $response->json('data.reference'))->first();
        $this->assertSame('266.67', (string) $order->items->firstWhere('sku', 'DAB-SAP-030')->unit_cost); // coût figé (marge)
    }

    public function test_le_stock_baisse_et_le_grand_livre_est_ecrit(): void
    {
        $this->postJson('/api/v1/orders', $this->payload([['product_id' => $this->id('DAB-SPH-250'), 'quantity' => 5]]))->assertCreated();

        $spray = Product::where('sku', 'DAB-SPH-250')->first();
        $this->assertSame(43, $spray->stock_quantity); // 48 - 5
        $this->assertDatabaseHas('stock_movements', ['product_id' => $spray->id, 'type' => 'sale', 'quantity' => -5, 'stock_after' => 43]);
    }

    public function test_stock_insuffisant_409_detaille_et_rien_n_est_enregistre(): void
    {
        $orders = Order::count();
        $this->postJson('/api/v1/orders', $this->payload([
            ['product_id' => $this->id('DAB-SPH-250'), 'quantity' => 2], // possible
            ['product_id' => $this->id('DAB-CRE-001'), 'quantity' => 1], // rupture
            ['product_id' => $this->id('DAB-SAP-030'), 'quantity' => 30], // 24 en stock
        ]))->assertStatus(409)
            ->assertJsonPath('message', 'Stock insuffisant pour certains produits.')
            // Les conflits sont listés dans l'ordre du panier
            ->assertJsonPath('items.0.name', 'Crème capillaire')
            ->assertJsonPath('items.0.available', 0)
            ->assertJsonPath('items.1', ['product_id' => $this->id('DAB-SAP-030'), 'name' => 'Sérum Activ’Pousse 30 ml', 'requested' => 30, 'available' => 24])
            ->assertJsonCount(2, 'items');

        // Transaction : AUCUNE écriture, même pour la ligne qui était possible
        $this->assertSame($orders, Order::count());
        $this->assertSame(48, Product::where('sku', 'DAB-SPH-250')->value('stock_quantity'));
    }

    public function test_livraison_sans_zone_ni_adresse_et_donnees_invalides(): void
    {
        $response = $this->postJson('/api/v1/orders', $this->payload([['product_id' => $this->id('DAB-SPH-250'), 'quantity' => 0]], ['fulfillment_method' => 'delivery', 'consent' => false]))
            ->assertUnprocessable()
            ->assertJsonPath('errors.delivery_zone_id.0', 'Choisissez votre zone de livraison.')
            ->assertJsonValidationErrors(['items.0.quantity', 'consent']);
        $this->assertSame('L’adresse est obligatoire pour une livraison.', $response->json('errors')['shipping_address.address_line'][0]);
        $this->postJson('/api/v1/orders', $this->payload([]))->assertJsonValidationErrors(['items']);
    }

    public function test_un_produit_inconnu_ou_retire_de_la_vente_est_refuse(): void
    {
        Product::where('sku', 'DAB-MAS-001')->update(['is_active' => false]);
        $this->postJson('/api/v1/orders', $this->payload([['product_id' => $this->id('DAB-MAS-001'), 'quantity' => 1]]))
            ->assertUnprocessable()->assertJsonPath('message', 'Un produit du panier n’existe plus ou n’est plus en vente.');
    }

    public function test_commande_connectee_visible_dans_le_compte_mais_pas_par_un_autre_client(): void
    {
        $mariama = User::where('email', 'mariama@client.test')->first();
        $reference = $this->actingAs($mariama)->postJson('/api/v1/orders', $this->payload([['product_id' => $this->id('DAB-SHA-001'), 'quantity' => 1]]))
            ->assertCreated()->json('data.reference');

        $this->getJson('/api/v1/me/orders')->assertOk()->assertJsonPath('data.0.reference', $reference)->assertJsonCount(3, 'data');
        $this->getJson("/api/v1/me/orders/{$reference}")->assertOk()->assertJsonPath('data.items.0.product_name', 'Shampooing sans sulfate');

        // IDOR : un autre client connecté ne peut pas lire cette commande en devinant la référence
        $other = User::factory()->create();
        // Changer d'utilisateur dans un même test : on vide la session de Mariama. Sinon, le middleware
        // AuthenticateSession de Sanctum détecte une empreinte de mot de passe différente et déconnecte (401)
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->actingAs($other, 'web')->getJson("/api/v1/me/orders/{$reference}")->assertForbidden()->assertJsonPath('message', 'Accès refusé.');
        $this->getJson('/api/v1/me/orders')->assertJsonCount(0, 'data');
    }
}
