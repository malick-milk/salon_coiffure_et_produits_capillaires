<?php

namespace Tests\Feature;

use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Tarifs de livraison gérés dans l'ERP (maquette validée le 21 novembre 2026) */
class DeliveryTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsRole(string $role): void
    {
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->actingAs(tap(User::factory()->create())->assignRole($role));
    }

    private function zone(string $name): DeliveryZone
    {
        return DeliveryZone::where('name', $name)->firstOrFail();
    }

    private function deliveryOrder(int $zoneId, string $sku = 'DAB-SPH-250', int $quantity = 1): TestResponse
    {
        $this->flushSession();
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/orders', [
            'items' => [['product_id' => Product::where('sku', $sku)->value('id'), 'quantity' => $quantity]], 'fulfillment_method' => 'delivery', 'delivery_zone_id' => $zoneId,
            'customer' => ['first_name' => 'Khady', 'last_name' => 'Fall', 'phone' => '76 111 22 33', 'email' => null],
            'shipping_address' => ['city' => 'Dakar', 'district' => 'Plateau', 'address_line' => 'Rue 10', 'landmark' => null], 'notes' => null, 'consent' => true,
        ]);
    }

    public function test_changer_les_frais_vaut_pour_les_nouvelles_commandes_seulement(): void
    {
        $plateau = $this->zone('Dakar Plateau');
        $old = $this->deliveryOrder($plateau->id)->assertCreated()->json('data.reference');

        $this->actingAsRole('super_admin');
        $this->patchJson("/api/v1/admin/delivery-zones/{$plateau->id}", ['fee' => 500, 'delay_label' => ' Le jour même '])->assertOk()
            ->assertJsonPath('data.fee', 500)->assertJsonPath('data.delay_label', 'Le jour même');

        $this->getJson('/api/v1/delivery-zones')->assertJsonPath('data.0.name', 'Dakar Plateau')->assertJsonPath('data.0.delay_label', 'Le jour même');
        $this->deliveryOrder($plateau->id)->assertCreated()->assertJsonPath('data.shipping_fee', 500);
        $this->assertSame(1000, Order::where('reference', $old)->value('shipping_fee')); // l'ancienne commande garde ses frais
        $this->assertDatabaseHas('activity_log', ['log_name' => 'delivery', 'subject_id' => $plateau->id]);
    }

    public function test_une_zone_cachee_disparait_du_site_et_ne_peut_plus_etre_choisie(): void
    {
        $rufisque = $this->zone('Rufisque');
        $this->actingAsRole('super_admin');
        $this->patchJson("/api/v1/admin/delivery-zones/{$rufisque->id}", ['is_active' => false])->assertOk();

        $this->assertNotContains('Rufisque', $this->getJson('/api/v1/delivery-zones')->collect('data')->pluck('name')->all());
        $this->assertNotSame(201, $this->deliveryOrder($rufisque->id)->status());
        $this->actingAsRole('super_admin');
        $this->assertContains('Rufisque', $this->getJson('/api/v1/admin/delivery')->collect('data.zones')->pluck('name')->all()); // toujours dans l'ERP
    }

    public function test_ajouter_une_zone_sans_doublon(): void
    {
        $this->actingAsRole('super_admin');
        $this->postJson('/api/v1/admin/delivery-zones', ['name' => 'Diamniadio', 'fee' => 2000, 'delay_label' => '48 h'])->assertCreated()->assertJsonPath('data.is_active', true);
        $this->postJson('/api/v1/admin/delivery-zones', ['name' => 'Diamniadio', 'fee' => 1000])->assertUnprocessable()->assertJsonPath('errors.name.0', 'Cette zone existe déjà.');
        $this->postJson('/api/v1/admin/delivery-zones', ['name' => 'X', 'fee' => -5])->assertUnprocessable()->assertJsonValidationErrors(['name', 'fee']);
    }

    public function test_livraison_offerte_a_partir_du_seuil(): void
    {
        $plateau = $this->zone('Dakar Plateau');
        $this->actingAsRole('super_admin');
        $this->putJson('/api/v1/admin/delivery-settings', ['free_delivery_threshold' => 500])->assertUnprocessable()
            ->assertJsonPath('errors.free_delivery_threshold.0', 'Le seuil de livraison offerte doit être d’au moins 1 000 F.');
        $this->putJson('/api/v1/admin/delivery-settings', ['free_delivery_threshold' => 10000])->assertOk()->assertJsonPath('data.free_delivery_threshold', 10000);
        $this->getJson('/api/v1/delivery-zones')->assertJsonPath('meta.free_delivery_threshold', 10000);

        $this->deliveryOrder($plateau->id, quantity: 2)->assertCreated()->assertJsonPath('data.shipping_fee', 0)->assertJsonPath('data.total', 10000); // 2 × 5 000 F
        $this->deliveryOrder($plateau->id)->assertCreated()->assertJsonPath('data.shipping_fee', 1000)->assertJsonPath('data.total', 6000);

        $this->actingAsRole('super_admin');
        $this->putJson('/api/v1/admin/delivery-settings', ['free_delivery_threshold' => null])->assertOk()->assertJsonPath('data.free_delivery_threshold', null);
        $this->deliveryOrder($plateau->id, quantity: 2)->assertCreated()->assertJsonPath('data.shipping_fee', 1000);
    }

    public function test_droits_et_compteur_des_commandes(): void
    {
        $plateau = $this->zone('Dakar Plateau');
        $count = fn () => collect($this->getJson('/api/v1/admin/delivery')->assertOk()->json('data.zones'))->firstWhere('name', 'Dakar Plateau')['orders_30d'];
        $this->actingAsRole('cashier');
        $before = $count(); // la démo contient déjà des commandes livrées
        $this->deliveryOrder($plateau->id)->assertCreated();

        $this->actingAsRole('cashier');
        $this->assertSame($before + 1, $count());
        $this->patchJson("/api/v1/admin/delivery-zones/{$plateau->id}", ['fee' => 0])->assertForbidden();
        $this->putJson('/api/v1/admin/delivery-settings', ['free_delivery_threshold' => 5000])->assertForbidden();
    }
}
