<?php

namespace Tests\Feature;

use App\Models\ConsignmentStatement;
use App\Models\Customer;
use App\Models\Order;
use App\Models\PickupPoint;
use App\Models\Product;
use App\Models\User;
use App\Notifications\PartnerMonthlyReminder;
use App\Notifications\PickupOrderReady;
use App\Notifications\PickupOrderToHandOver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** Étape 14 : points de retrait partenaires (dépôt-vente mensuel, retrait des commandes en ligne avec code) */
class PickupPointsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-11-10 10:00:00', 'UTC'));
        $this->admin = User::where('email', 'admin@dabohair.test')->first();
    }

    private function id(string $sku): int
    {
        return Product::where('sku', $sku)->value('id');
    }

    private function stock(string $sku): int
    {
        return Product::where('sku', $sku)->value('stock_quantity');
    }

    private function partnerStock(PickupPoint $p, string $sku): int
    {
        return (int) \DB::table('pickup_point_stocks')->where(['pickup_point_id' => $p->id, 'product_id' => $this->id($sku)])->value('quantity');
    }

    /** Point de Thiès avec une livraison : 10 sérums (3 000 F) et 4 sprays (5 000 F) */
    private function pointWithStock(): PickupPoint
    {
        $this->actingAs($this->admin);
        $id = $this->postJson('/api/v1/admin/pickup-points', [
            'name' => 'Boutique de Moussa Diop', 'owner_name' => 'Moussa Diop', 'phone' => '77 123 12 34', 'regions' => ['Thiès'],
            'city' => 'Thiès', 'address' => 'Marché central', 'opening_hours' => 'Lundi au samedi, 9 h – 19 h',
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/v1/admin/pickup-points/{$id}/deliveries", ['items' => [
            ['product_id' => $this->id('DAB-SAP-030'), 'quantity' => 10], ['product_id' => $this->id('DAB-SPH-250'), 'quantity' => 4],
        ]])->assertCreated();

        return PickupPoint::findOrFail($id);
    }

    private function orderPayload(PickupPoint $p, int $qty = 2): array
    {
        return [
            'items' => [['product_id' => $this->id('DAB-SAP-030'), 'quantity' => $qty]], 'fulfillment_method' => 'pickup_point', 'pickup_point_id' => $p->id,
            'delivery_zone_id' => null, 'customer' => ['first_name' => 'Fatou', 'last_name' => 'Ndiaye', 'phone' => '76 222 33 44', 'email' => 'fatou@exemple.sn'],
            'shipping_address' => null, 'notes' => null, 'consent' => true,
        ];
    }

    /** Commande en ligne passée puis préparée jusqu'à « prête à retirer » ; renvoie [commande, lien du partenaire] */
    private function readyOrder(PickupPoint $p): array
    {
        Notification::fake();
        $ref = $this->postJson('/api/v1/orders', $this->orderPayload($p))->assertCreated()->json('data.reference');
        $this->actingAs($this->admin);
        foreach (['confirmed', 'preparing', 'ready'] as $status) {
            $this->patchJson("/api/v1/admin/orders/{$ref}/status", ['status' => $status])->assertOk();
        }
        $token = null;
        Notification::assertSentTo($p, PickupOrderToHandOver::class, function (PickupOrderToHandOver $n) use (&$token) {
            $token = $n->token;

            return true;
        });

        return [Order::where('reference', $ref)->first(), $token];
    }

    // ---------- Partenaires et livraisons ----------

    public function test_creer_un_point_exige_un_mobile_senegalais_et_des_regions_valides(): void
    {
        $this->actingAs($this->admin)->postJson('/api/v1/admin/pickup-points', ['name' => 'X', 'owner_name' => 'Y', 'phone' => '33 823 45 67', 'regions' => ['Casamance'], 'city' => 'Z', 'address' => 'A'])
            ->assertJsonValidationErrors(['phone', 'regions.0']);
    }

    public function test_le_caissier_n_accede_pas_aux_points_de_retrait(): void
    {
        $this->actingAs(tap(User::factory()->create())->assignRole('cashier'))->getJson('/api/v1/admin/pickup-points')->assertForbidden();
    }

    public function test_la_gerante_gere_les_points_de_retrait(): void
    {
        $this->actingAs(tap(User::factory()->create())->assignRole('manager'))->getJson('/api/v1/admin/pickup-points')->assertOk();
    }

    public function test_une_livraison_deplace_le_stock_du_salon_vers_le_partenaire_avec_un_bon_de_depot(): void
    {
        $before = $this->stock('DAB-SAP-030');
        $p = $this->pointWithStock();

        $this->assertSame($before - 10, $this->stock('DAB-SAP-030'));
        $this->assertSame(10, $this->partnerStock($p, 'DAB-SAP-030'));
        $this->assertDatabaseHas('stock_movements', ['product_id' => $this->id('DAB-SAP-030'), 'type' => 'consignment_out', 'quantity' => -10]);
        $this->assertDatabaseHas('consignment_deliveries', ['pickup_point_id' => $p->id, 'number' => 'BD-2026-000001', 'total_quantity' => 14, 'total_value' => 50000]);

        $delivery = $p->deliveries()->first();
        $this->get("/api/v1/admin/consignment-deliveries/{$delivery->id}/pdf")->assertOk()->assertHeader('content-type', 'application/pdf');

        // Plus que le stock du salon : refusé, rien ne bouge
        $this->postJson("/api/v1/admin/pickup-points/{$p->id}/deliveries", ['items' => [['product_id' => $this->id('DAB-CRE-001'), 'quantity' => 1]]])->assertStatus(409);
        $this->assertSame(1, $p->deliveries()->count());

        $this->getJson('/api/v1/admin/pickup-points')->assertOk()->assertJsonPath('data.0.stock_units', 14)->assertJsonPath('data.0.stock_value', 50000)
            ->assertJsonPath('summary.regions_covered', ['Thiès']);
    }

    // ---------- Commande en ligne à retirer chez le partenaire ----------

    public function test_la_commande_en_ligne_est_servie_par_le_stock_du_partenaire(): void
    {
        $p = $this->pointWithStock();
        $salon = $this->stock('DAB-SAP-030');
        $this->getJson('/api/v1/pickup-points')->assertOk()->assertJsonPath('data.0.city', 'Thiès')->assertJsonMissingPath('data.0.phone');

        $this->postJson('/api/v1/orders', $this->orderPayload($p, 11))->assertStatus(409)->assertJsonPath('items.0.available', 10);
        $this->postJson('/api/v1/orders', $this->orderPayload($p, 2))->assertCreated()
            ->assertJsonPath('data.pickup_point.city', 'Thiès')->assertJsonPath('data.pickup_code', null);

        $this->assertSame(8, $this->partnerStock($p, 'DAB-SAP-030'));
        $this->assertSame($salon, $this->stock('DAB-SAP-030')); // le stock du salon ne bouge pas
        $this->postJson('/api/v1/orders', [...$this->orderPayload($p), 'pickup_point_id' => null])->assertJsonValidationErrors(['pickup_point_id']);
    }

    public function test_prete_la_cliente_recoit_son_code_et_le_partenaire_un_lien_de_remise(): void
    {
        $p = $this->pointWithStock();
        [$order, $token] = $this->readyOrder($p);

        $this->assertMatchesRegularExpression('/^\d{4}$/', $order->pickup_code);
        $this->assertSame(64, strlen($order->handover_token_hash)); // le lien n'est jamais stocké en clair
        Notification::assertSentTo($order->customer, PickupOrderReady::class, fn (PickupOrderReady $n) => str_contains($n->toSms($order->customer)->text, "Code de retrait : {$order->pickup_code}"));
        Notification::assertSentTo($p, PickupOrderToHandOver::class, fn (PickupOrderToHandOver $n) => str_contains($n->toSms($p)->text, "http://localhost:5173/retrait/{$token}")
            && ! str_contains($n->toSms($p)->text, $order->pickup_code)); // le partenaire n'a PAS le code : seule la cliente l'a
    }

    public function test_remise_avec_le_bon_code_et_blocage_apres_5_erreurs(): void
    {
        $p = $this->pointWithStock();
        [$order, $token] = $this->readyOrder($p);
        $wrong = $order->pickup_code === '0000' ? '1111' : '0000';

        $this->getJson("/api/v1/handover/{$token}")->assertOk()->assertJsonPath('data.state', 'ready')
            ->assertJsonPath('data.customer_first_name', $order->customer->first_name)->assertJsonPath('data.items.0.quantity', 2);
        $this->postJson("/api/v1/handover/{$token}", ['code' => $wrong])->assertJsonValidationErrors(['code']);
        $this->postJson("/api/v1/handover/{$token}", ['code' => $order->pickup_code])->assertOk()->assertJsonPath('data.state', 'handed_over');

        $order->refresh();
        $this->assertSame('delivered', $order->status->value);
        $this->assertNotNull($order->picked_up_at);
        $this->postJson("/api/v1/handover/{$token}", ['code' => $order->pickup_code])->assertStatus(409);
        $this->getJson('/api/v1/handover/'.str_repeat('a', 40))->assertNotFound();

        [$other, $token2] = $this->readyOrder($p);
        $bad = $other->pickup_code === '0000' ? '1111' : '0000';
        for ($i = 0; $i < 5; $i++) {
            $this->postJson("/api/v1/handover/{$token2}", ['code' => $bad])->assertStatus(422);
        }
        $this->postJson("/api/v1/handover/{$token2}", ['code' => $other->pickup_code])->assertStatus(429); // même le bon code est bloqué 15 min
    }

    public function test_annuler_une_commande_remet_les_produits_chez_le_partenaire(): void
    {
        $p = $this->pointWithStock();
        Notification::fake();
        $ref = $this->postJson('/api/v1/orders', $this->orderPayload($p, 3))->json('data.reference');
        $this->assertSame(7, $this->partnerStock($p, 'DAB-SAP-030'));
        $this->actingAs($this->admin)->patchJson("/api/v1/admin/orders/{$ref}/status", ['status' => 'cancelled', 'reason' => 'Cliente injoignable'])->assertOk();
        $this->assertSame(10, $this->partnerStock($p, 'DAB-SAP-030'));
        $this->assertDatabaseHas('pickup_point_movements', ['pickup_point_id' => $p->id, 'type' => 'online_order_cancelled', 'quantity' => 3]);
    }

    // ---------- Relevé de fin de mois ----------

    public function test_releve_ventes_au_comptoir_commandes_en_ligne_commission_et_montant_du(): void
    {
        $p = $this->pointWithStock();
        [$order, $token] = $this->readyOrder($p);
        $this->postJson("/api/v1/handover/{$token}", ['code' => $order->pickup_code])->assertOk(); // 2 sérums en ligne (6 000 F)

        // Attendu : 8 sérums et 4 sprays. Compté : 3 sérums (1 abîmé) et 2 sprays → comptoir : 4 sérums + 2 sprays
        $counts = ['counts' => [
            ['product_id' => $this->id('DAB-SAP-030'), 'counted' => 3, 'damaged' => 1],
            ['product_id' => $this->id('DAB-SPH-250'), 'counted' => 2, 'damaged' => 0],
        ]];
        $t = $this->postJson("/api/v1/admin/pickup-points/{$p->id}/statements/preview", $counts)->assertOk()->json('data.totals');
        $this->assertSame(22000, $t['counter_sales_total']); // 4 × 3 000 + 2 × 5 000
        $this->assertSame(6000, $t['online_sales_total']);
        $this->assertSame(28000, $t['sales_total']);
        $this->assertSame(2800, $t['commission_gross']);      // 10 %
        $this->assertSame(3000, $t['damaged_value']);
        $this->assertSame(0, $t['commission_net']);           // plafonnée à 0 (règle du 9 novembre)
        $this->assertSame(28000, $t['amount_due']);
        $this->assertSame(8, $t['sold_qty']);

        $this->postJson("/api/v1/admin/pickup-points/{$p->id}/statements", ['period' => '2026-10', 'declared_sold' => 7, ...$counts])->assertJsonValidationErrors(['gap_note']);
        $this->postJson("/api/v1/admin/pickup-points/{$p->id}/statements", ['period' => '2026-10', 'declared_sold' => 7, 'gap_note' => 'Oubli d’un spray vendu samedi', ...$counts])
            ->assertCreated()->assertJsonPath('data.amount_due', 28000)->assertJsonPath('data.due_date', '2026-11-05')->assertJsonPath('data.payment_state', 'overdue');

        $this->assertSame(3, $this->partnerStock($p, 'DAB-SAP-030')); // stock ramené au comptage
        $this->assertSame(2, $this->partnerStock($p, 'DAB-SPH-250'));
        $statement = ConsignmentStatement::sole();
        $counter = Order::find($statement->counter_order_id);
        $this->assertSame(['partner', 22000, 'delivered'], [$counter->channel->value, $counter->total, $counter->status->value]);
        $this->assertSame($statement->id, $order->fresh()->consignment_statement_id);

        $this->postJson("/api/v1/admin/pickup-points/{$p->id}/statements", ['period' => '2026-10', ...$counts])->assertJsonValidationErrors(['period']);
        $this->get("/api/v1/admin/consignment-statements/{$statement->id}/pdf")->assertOk()->assertHeader('content-type', 'application/pdf');
    }

    public function test_un_comptage_superieur_au_stock_attendu_est_refuse(): void
    {
        $p = $this->pointWithStock();
        $this->postJson("/api/v1/admin/pickup-points/{$p->id}/statements/preview", ['counts' => [['product_id' => $this->id('DAB-SAP-030'), 'counted' => 9, 'damaged' => 2]]])
            ->assertJsonValidationErrors(['counts.'.$this->id('DAB-SAP-030').'.counted']);
    }

    public function test_commission_normale_quand_rien_n_est_abime(): void
    {
        $p = $this->pointWithStock();
        $t = $this->postJson("/api/v1/admin/pickup-points/{$p->id}/statements/preview", ['counts' => [
            ['product_id' => $this->id('DAB-SAP-030'), 'counted' => 0], ['product_id' => $this->id('DAB-SPH-250'), 'counted' => 4],
        ]])->json('data.totals');
        $this->assertSame([30000, 3000, 3000, 27000], [$t['sales_total'], $t['commission_gross'], $t['commission_net'], $t['amount_due']]);
    }

    public function test_le_versement_encaisse_chaque_commande_du_releve_et_emet_les_factures(): void
    {
        $p = $this->pointWithStock();
        [$order, $token] = $this->readyOrder($p);
        $this->postJson("/api/v1/handover/{$token}", ['code' => $order->pickup_code]);
        $id = $this->postJson("/api/v1/admin/pickup-points/{$p->id}/statements", ['period' => '2026-10', 'counts' => [['product_id' => $this->id('DAB-SAP-030'), 'counted' => 6]]])->json('data.id');

        $this->postJson("/api/v1/admin/consignment-statements/{$id}/payment", ['method' => 'wave'])->assertOk()->assertJsonPath('data.payment_state', 'paid');
        $statement = ConsignmentStatement::find($id);
        foreach ([$order->id, $statement->counter_order_id] as $orderId) {
            $this->assertSame('paid', Order::find($orderId)->payment_status->value);
            $this->assertDatabaseHas('invoices', ['order_id' => $orderId, 'type' => 'invoice']);
        }
        $this->postJson("/api/v1/admin/consignment-statements/{$id}/payment", ['method' => 'wave'])->assertJsonValidationErrors(['statement']);
    }

    public function test_alerte_d_investigation_apres_deux_mois_avec_des_abimes(): void
    {
        $p = $this->pointWithStock();
        $sap = $this->id('DAB-SAP-030');
        $this->postJson("/api/v1/admin/pickup-points/{$p->id}/statements", ['period' => '2026-09', 'counts' => [['product_id' => $sap, 'counted' => 8, 'damaged' => 1]]])->assertCreated();
        $this->getJson("/api/v1/admin/pickup-points/{$p->id}")->assertJsonPath('data.needs_investigation', false);
        $this->postJson("/api/v1/admin/pickup-points/{$p->id}/statements", ['period' => '2026-10', 'counts' => [['product_id' => $sap, 'counted' => 6, 'damaged' => 1]]])->assertCreated();
        $this->getJson("/api/v1/admin/pickup-points/{$p->id}")->assertOk()->assertJsonPath('data.needs_investigation', true)
            ->assertJsonPath('data.statements.0.period', '2026-10');
        $this->getJson('/api/v1/admin/pickup-points')->assertJsonPath('summary.investigations', 1);
    }

    public function test_rappel_mensuel_aux_partenaires_actifs(): void
    {
        $p = $this->pointWithStock();
        PickupPoint::create(['name' => 'Fermé', 'owner_name' => 'Ancien Partenaire', 'phone' => '770009999', 'regions' => ['Louga'], 'city' => 'Louga', 'address' => 'x', 'is_active' => false]);
        Notification::fake();
        $this->artisan('partners:remind')->expectsOutput('1 point(s) de retrait prévenu(s).')->assertSuccessful();
        Notification::assertSentTo($p, PartnerMonthlyReminder::class, fn (PartnerMonthlyReminder $n) => str_contains($n->toSms($p)->text, 'bonjour Moussa') && str_contains($n->toSms($p)->text, 'octobre 2026'));
        $this->assertSame(1, Notification::sent($p, PartnerMonthlyReminder::class)->count());
        $this->assertNotNull(Customer::query()->count());
    }
}
