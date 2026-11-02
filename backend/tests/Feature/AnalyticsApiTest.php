<?php

namespace Tests\Feature;

use App\Actions\Admin\RecordPaymentAction;
use App\Actions\PlaceOrderAction;
use App\Enums\PaymentMethod;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\Analytics\SnapshotBuilder;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Étape 8 : tableau de bord décisionnel, agrégats quotidiens, exports, historique de démonstration */
class AnalyticsApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::where('email', 'admin@dabohair.test')->first();
    }

    private function today(): string
    {
        return CarbonImmutable::today()->toDateString();
    }

    /** Commande payée aujourd'hui, passée par les vraies classes métier */
    private function paidOrder(array $items, PaymentMethod $method = PaymentMethod::Wave): Order
    {
        $order = app(PlaceOrderAction::class)->execute(['items' => $items, 'fulfillment_method' => 'pickup', 'delivery_zone_id' => null,
            'customer' => ['first_name' => 'Awa', 'last_name' => 'Test', 'phone' => '771112233', 'email' => null], 'shipping_address' => null, 'notes' => null], null);
        app(RecordPaymentAction::class)->execute($order, $method, $this->admin);

        return $order->refresh();
    }

    /** Changer d'utilisateur dans un même test : vider la session (AuthenticateSession la lie au mot de passe) */
    private function switchTo(User $user): void
    {
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->actingAs($user, 'web');
    }

    private function sku(string $sku): int
    {
        return Product::where('sku', $sku)->value('id');
    }

    public function test_reserve_au_proprietaire(): void
    {
        $this->getJson('/api/v1/admin/analytics')->assertUnauthorized();
        foreach (['cashier', 'manager', 'stylist'] as $role) {
            $this->switchTo(tap(User::factory()->create())->assignRole($role));
            $this->getJson('/api/v1/admin/analytics')->assertForbidden();
            $this->get('/api/v1/admin/analytics/export/daily_sales')->assertForbidden();
        }
        $this->switchTo($this->admin);
        $this->getJson('/api/v1/admin/analytics')->assertOk()
            ->assertJsonPath('data.period.days', 30)->assertJsonPath('data.period.granularity', 'day');
    }

    public function test_kpis_du_jour_calcules_sur_les_vraies_commandes(): void
    {
        $this->actingAs($this->admin);
        app(RecordPaymentAction::class)->execute(Order::where('reference', 'CMD-2026-000102')->first(), PaymentMethod::Cash, $this->admin); // 2 crèmes, 6 000
        $this->paidOrder([['product_id' => $this->sku('DAB-SPH-250'), 'quantity' => 2]]); // 2 sprays, 10 000

        $kpis = $this->getJson("/api/v1/admin/analytics?from={$this->today()}&to={$this->today()}")->assertOk()->json('data.kpis.current');
        $this->assertSame(16000, $kpis['revenue']);
        $this->assertSame(2, $kpis['orders']);
        $this->assertSame(4, $kpis['items_sold']);
        $this->assertSame(8000, $kpis['average_basket']); // panier moyen = 16 000 / 2
        $this->assertSame(5700 + 9300, $kpis['gross_margin']); // 2 × (3 000 − 150) + 2 × (5 000 − 350)
        $this->assertEquals(93.8, $kpis['margin_rate']);
    }

    public function test_une_marge_inconnue_n_est_jamais_comptee_comme_nulle(): void
    {
        $this->actingAs($this->admin);
        $this->paidOrder([['product_id' => $this->sku('DAB-SAP-015'), 'quantity' => 2]]); // coût du sérum 15 ml inconnu

        $data = $this->getJson("/api/v1/admin/analytics?from={$this->today()}&to={$this->today()}")->json('data');
        $this->assertNull($data['kpis']['current']['gross_margin']); // aucun CA au coût connu : pas de marge inventée
        $this->assertNull($data['top_products'][0]['margin']);
        $this->assertContains('Sérum Activ’Pousse 15 ml', $data['data_quality']['products_without_cost']);
        $this->assertEquals(0, $data['data_quality']['costed_revenue_share']);
    }

    public function test_comparaison_avec_la_periode_precedente(): void
    {
        $this->actingAs($this->admin);
        $data = $this->getJson('/api/v1/admin/analytics?from=2026-03-25&to=2026-03-31')->json('data');
        $this->assertSame(['from' => '2026-03-18', 'to' => '2026-03-24'], $data['previous_period']);
        $this->assertSame(7, count($data['series'])); // un point par jour, même sans vente
        $this->assertSame(0, $data['kpis']['current']['revenue']);
    }

    public function test_prevision_de_rupture_par_couverture_de_stock(): void
    {
        $this->actingAs($this->admin);
        $this->paidOrder([['product_id' => $this->sku('DAB-SPH-250'), 'quantity' => 9]]); // 48 -> 39, demande = 9 / 90 = 0,1 par jour

        $spray = collect($this->getJson('/api/v1/admin/analytics')->json('data.stock'))->firstWhere('name', 'Spray hydratant 250 ml');
        $this->assertSame(39, $spray['stock']);
        $this->assertEquals(0.1, $spray['avg_daily_demand']);
        $this->assertSame(390, $spray['days_of_cover']); // 39 / 0,1
        $this->assertSame(CarbonImmutable::today()->addDays(390)->toDateString(), $spray['stockout_date']);

        $creme = collect($this->getJson('/api/v1/admin/analytics')->json('data.stock'))->firstWhere('name', 'Crème capillaire');
        $this->assertSame('out_of_stock', $creme['status']);
    }

    public function test_les_agregats_sont_idempotents_et_le_stock_historique_suit_le_grand_livre(): void
    {
        $builder = app(SnapshotBuilder::class);
        $builder->build(CarbonImmutable::parse('2026-03-19'), CarbonImmutable::parse('2026-03-25'));
        $first = DB::table('daily_product_stats')->orderBy('date')->orderBy('product_id')->get(['date', 'product_id', 'quantity_sold', 'stock_end']);
        $builder->build(CarbonImmutable::parse('2026-03-19'), CarbonImmutable::parse('2026-03-25'));
        $this->assertEquals($first, DB::table('daily_product_stats')->orderBy('date')->orderBy('product_id')->get(['date', 'product_id', 'quantity_sold', 'stock_end']));

        $creme = $this->sku('DAB-CRE-001');
        $stock = fn (string $day) => DB::table('daily_product_stats')->where(['date' => $day, 'product_id' => $creme])->value('stock_end');
        $this->assertSame(0, $stock('2026-03-19'));  // avant la fabrication
        $this->assertSame(96, $stock('2026-03-20')); // lot de 96
        $this->assertSame(0, $stock('2026-03-24'));  // vente en gros au revendeur
        $this->assertSame(96, DB::table('daily_product_stats')->where(['date' => '2026-03-24', 'product_id' => $creme])->value('quantity_sold'));
    }

    public function test_periode_validee(): void
    {
        $this->actingAs($this->admin);
        $this->getJson('/api/v1/admin/analytics?from=2026-03-10&to=2026-03-01')->assertUnprocessable();
        $this->getJson('/api/v1/admin/analytics?to='.CarbonImmutable::tomorrow()->toDateString())->assertUnprocessable();
        $this->getJson('/api/v1/admin/analytics?from=2023-01-01&to=2026-03-01')->assertUnprocessable();
        $this->getJson('/api/v1/admin/analytics?from=2026-13-01')->assertUnprocessable();
    }

    public function test_export_csv_minimise_les_donnees_personnelles(): void
    {
        $this->actingAs($this->admin);
        $this->paidOrder([['product_id' => $this->sku('DAB-SHA-001'), 'quantity' => 1]]);

        $response = $this->get("/api/v1/admin/analytics/export/order_lines?from={$this->today()}&to={$this->today()}")->assertOk();
        $this->assertStringStartsWith('text/csv', $response->headers->get('Content-Type'));
        $csv = $response->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBForder_reference;placed_at;paid_at", $csv);
        $this->assertStringContainsString(';wave;', $csv);
        $this->assertStringNotContainsString('Awa', $csv);        // pas de nom
        $this->assertStringNotContainsString('771112233', $csv);  // pas de téléphone

        $daily = $this->get('/api/v1/admin/analytics/export/daily_sales?from=2026-03-20&to=2026-03-21')->streamedContent();
        $this->assertSame(3, substr_count(trim($daily), "\n") + 1); // en-tête + 2 jours
        $this->get('/api/v1/admin/analytics/export/clients')->assertUnprocessable() // jeu de données inconnu
            ->assertJsonPath('errors.dataset.0', 'Le jeu de données est invalide.');
    }

    public function test_historique_refuse_si_la_base_contient_deja_une_activite_recente(): void
    {
        $this->postJson('/api/v1/orders', [
            'items' => [['product_id' => $this->sku('DAB-SPH-250'), 'quantity' => 1]], 'fulfillment_method' => 'pickup',
            'customer' => ['first_name' => 'Awa', 'last_name' => 'Test', 'phone' => '771112233'], 'consent' => true,
        ])->assertCreated(); // une vente aujourd'hui = un mouvement de stock postérieur au début de l'historique
        $this->artisan('app:demo-history', ['--days' => 10])->assertFailed();
    }

    public function test_historique_de_demonstration_coherent(): void
    {
        $this->artisan('app:demo-history', ['--days' => 10])->assertSuccessful();
        $this->artisan('app:demo-history', ['--days' => 10])->assertFailed(); // déjà généré : pas de doublon

        // Le cache du stock égale toujours la somme du grand livre, et le grand livre se relit dans l'ordre du temps
        foreach (Product::all() as $product) {
            $this->assertSame($product->stock_quantity, (int) $product->stockMovements()->sum('quantity'), $product->sku);
        }
        $disorder = DB::selectOne('SELECT COUNT(*) n FROM (SELECT stock_after, SUM(quantity) OVER (PARTITION BY product_id ORDER BY created_at, id) run FROM stock_movements) x WHERE stock_after <> run')->n;
        $this->assertSame(0, (int) $disorder);
        $this->assertSame(0, DB::table('activity_log')->where('created_at', '<', CarbonImmutable::today())->count()); // la démo ne pollue pas l'audit
    }
}
