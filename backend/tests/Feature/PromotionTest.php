<?php

namespace Tests\Feature;

use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\User;
use App\Services\Catalog\PromotionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Promotions en pourcentage depuis l'ERP (maquettes validées le 20 novembre 2026) : le prix initial reste intact */
class PromotionTest extends TestCase
{
    use RefreshDatabase;

    private function id(string $sku): int
    {
        return Product::where('sku', $sku)->value('id');
    }

    private function actingAsRole(string $role): User
    {
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $user = tap(User::factory()->create())->assignRole($role);
        $this->actingAs($user);

        return $user;
    }

    private function createPromotion(array $over = []): TestResponse
    {
        return $this->postJson('/api/v1/admin/promotions', [
            'name' => 'Fêtes de fin d’année', 'percent' => 20, 'starts_on' => now()->toDateString(), 'ends_on' => now()->addDays(30)->toDateString(),
            'audience' => 'all', 'product_ids' => [$this->id('DAB-SPH-250'), $this->id('DAB-SHA-001')], ...$over,
        ]);
    }

    private function order(string $sku, int $quantity = 1): TestResponse
    {
        return $this->postJson('/api/v1/orders', [
            'items' => [['product_id' => $this->id($sku), 'quantity' => $quantity]], 'fulfillment_method' => 'pickup', 'delivery_zone_id' => null,
            'customer' => ['first_name' => 'Khady', 'last_name' => 'Fall', 'phone' => '76 111 22 33', 'email' => null], 'shipping_address' => null, 'notes' => null, 'consent' => true,
        ]);
    }

    public function test_le_prix_promo_est_calcule_et_le_prix_initial_reste_intact(): void
    {
        $this->actingAsRole('super_admin');
        $this->createPromotion()->assertCreated()->assertJsonPath('data.status', 'current')->assertJsonPath('data.products.0.promo_price', 4000);

        $fiche = $this->getJson('/api/v1/products/spray-hydratant-250-ml')->assertOk()->json('data');
        $this->assertSame([5000, 20, 4000, true], [$fiche['price'], $fiche['promotion']['percent'], $fiche['promotion']['price'], $fiche['promotion']['applies']]);

        $this->order('DAB-SPH-250', 2)->assertCreated()->assertJsonPath('data.subtotal', 8000);
        $item = OrderItem::latest('id')->first();
        $this->assertSame([4000, 5000, Promotion::first()->id], [$item->unit_price, $item->regular_unit_price, $item->promotion_id]);
        $this->assertSame(5000, Product::where('sku', 'DAB-SPH-250')->value('price')); // jamais modifié
    }

    public function test_arrondi_a_la_dizaine_inferieure(): void
    {
        $this->assertSame(2970, PromotionService::discounted(3500, 15)); // 2 975 -> 2 970
        $this->assertSame(4160, PromotionService::discounted(5200, 20));
        $this->assertSame(1500, PromotionService::discounted(3000, 50));
    }

    public function test_promotion_reservee_aux_membres(): void
    {
        $this->actingAsRole('super_admin');
        $this->createPromotion(['audience' => 'members'])->assertCreated();

        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/products/spray-hydratant-250-ml')->assertJsonPath('data.promotion.applies', false);
        $this->order('DAB-SPH-250')->assertCreated()->assertJsonPath('data.subtotal', 5000); // sans compte : prix normal

        $this->actingAsRole('customer');
        $this->getJson('/api/v1/products/spray-hydratant-250-ml')->assertJsonPath('data.promotion.applies', true);
        $this->order('DAB-SPH-250')->assertCreated()->assertJsonPath('data.subtotal', 4000);
    }

    public function test_regles_de_creation(): void
    {
        $this->actingAsRole('super_admin');
        $this->createPromotion(['percent' => 4])->assertUnprocessable()->assertJsonPath('errors.percent.0', 'La réduction va de 5 % à 70 %.');
        $this->createPromotion(['percent' => 71])->assertUnprocessable()->assertJsonValidationErrors(['percent']);
        $this->createPromotion(['percent' => 60])->assertUnprocessable()->assertJsonPath('errors.percent.0', 'Plus de 50 % de réduction : confirmez que c’est voulu.');
        $this->createPromotion(['starts_on' => now()->subDay()->toDateString()])->assertUnprocessable()->assertJsonValidationErrors(['starts_on']);
        $this->createPromotion(['product_ids' => [$this->id('DAB-GAM-001')]])->assertUnprocessable()
            ->assertJsonPath('errors.product_ids.0', 'Gamme complète Dabo Hair 6 soins a déjà son prix membre : pas de promotion en plus.');

        $this->createPromotion(['percent' => 60, 'confirm_high_discount' => true])->assertCreated();
        // Le spray est déjà en promotion sur ces dates
        $this->createPromotion(['name' => 'Autre', 'starts_on' => now()->addDays(5)->toDateString(), 'product_ids' => [$this->id('DAB-SPH-250')]])->assertUnprocessable()
            ->assertJsonPath('errors.product_ids.0', 'Déjà en promotion sur ces dates : Spray hydratant 250 ml (« Fêtes de fin d’année »).');
    }

    public function test_arreter_maintenant_et_modifier_une_promotion_en_cours(): void
    {
        $this->actingAsRole('super_admin');
        $id = $this->createPromotion()->json('data.id');

        // En cours : seuls le nom et la date de fin changent
        $this->patchJson("/api/v1/admin/promotions/{$id}", ['name' => 'Fêtes 2026', 'percent' => 50, 'ends_on' => now()->addDays(10)->toDateString()])
            ->assertOk()->assertJsonPath('data.name', 'Fêtes 2026')->assertJsonPath('data.percent', 20);

        $this->postJson("/api/v1/admin/promotions/{$id}/stop")->assertOk()->assertJsonPath('data.status', 'ended');
        $this->getJson('/api/v1/products/spray-hydratant-250-ml')->assertJsonPath('data.promotion', null);
        $this->order('DAB-SPH-250')->assertCreated()->assertJsonPath('data.subtotal', 5000);
        $this->patchJson("/api/v1/admin/promotions/{$id}", ['name' => 'X', 'ends_on' => now()->addDay()->toDateString()])->assertUnprocessable();
        $this->assertDatabaseHas('activity_log', ['log_name' => 'promotions', 'subject_id' => $id]);
    }

    public function test_une_promotion_a_venir_ne_s_applique_pas_encore(): void
    {
        $this->actingAsRole('super_admin');
        $this->createPromotion(['starts_on' => now()->addDays(3)->toDateString()])->assertCreated()->assertJsonPath('data.status', 'upcoming');

        $this->getJson('/api/v1/products/spray-hydratant-250-ml')->assertJsonPath('data.promotion', null);
        $this->order('DAB-SPH-250')->assertCreated()->assertJsonPath('data.subtotal', 5000);
    }

    public function test_resultats_avant_contre_pendant(): void
    {
        $this->actingAsRole('super_admin');
        $start = now()->startOfDay();
        $id = $this->createPromotion(['product_ids' => [$this->id('DAB-SPH-250')]])->json('data.id');

        // Avant : 7 sprays vendus sur les 7 jours d'avant (1 par jour) ; pendant : 3 jours, 6 sprays (2 par jour)
        for ($d = 7; $d >= 1; $d--) {
            $this->travelTo($start->copy()->subDays($d)->setTime(10, 0));
            $this->order('DAB-SPH-250')->assertCreated();
        }
        for ($d = 0; $d <= 2; $d++) {
            $this->travelTo($start->copy()->addDays($d)->setTime(10, 0));
            $this->order('DAB-SPH-250', 2)->assertCreated();
        }

        $r = $this->getJson("/api/v1/admin/promotions/{$id}/results")->assertOk()->json('data');
        $this->assertSame([7, 3, 10], [$r['days_before'], $r['days_during'], count($r['series'])]);
        $this->assertEquals(['units' => 1, 'revenue' => 5000, 'margin' => 4650, 'margin_partial' => false, 'discount' => 0], $r['totals']['before']);
        $this->assertEquals(['units' => 2, 'revenue' => 8000, 'margin' => 7300, 'margin_partial' => false, 'discount' => 2000], $r['totals']['during']);
        $this->assertSame(['units' => 100, 'revenue' => 60, 'margin' => 57], $r['totals']['change']); // +100 % de ventes, +60 % de CA, +57 % de marge
        $this->assertSame(6, $r['totals']['units_sold']);
        $this->assertSame(0, $this->getJson('/api/v1/admin/promotions')->json('data.0.summary.before.discount'));
    }

    public function test_droits_le_caissier_voit_mais_ne_cree_pas(): void
    {
        $this->actingAsRole('cashier');
        $this->getJson('/api/v1/admin/promotions')->assertOk();
        $this->createPromotion()->assertForbidden();
    }
}
