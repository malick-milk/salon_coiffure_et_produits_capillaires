<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Activitylog\Models\Activity;
use Tests\TestCase;

/** ERP : permissions (RBAC), machines à états, paiements, factures, stock, fabrication, audit */
class AdminApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::where('email', 'admin@dabohair.test')->first();
    }

    private function staff(string $role): User
    {
        return tap(User::factory()->create())->assignRole($role);
    }

    // ---------- Permissions ----------

    public function test_visiteur_401_client_403_personnel_autorise(): void
    {
        $this->getJson('/api/v1/admin/dashboard')->assertUnauthorized();
        $this->actingAs(User::where('email', 'mariama@client.test')->first())->getJson('/api/v1/admin/dashboard')
            ->assertForbidden()->assertJsonPath('message', 'Vous n’avez pas la permission d’effectuer cette action.');
    }

    public function test_le_caissier_voit_les_commandes_mais_pas_les_montants_ni_l_equipe(): void
    {
        $this->actingAs($this->staff('cashier'));
        $this->getJson('/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('data.revenue_month', null) // RBAC appliqué AUX DONNÉES
            ->assertJsonPath('data.top_products.0.margin', null);
        $this->getJson('/api/v1/admin/orders')->assertOk();
        $this->getJson('/api/v1/admin/users')->assertForbidden();
        $this->postJson('/api/v1/admin/products/1/stock-adjustments', ['type' => 'loss', 'quantity' => 1, 'reason' => 'Test'])->assertForbidden();
    }

    public function test_le_proprietaire_voit_le_chiffre_d_affaires_et_les_alertes(): void
    {
        $this->actingAs($this->admin)->getJson('/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('data.stock_alerts.0.name', 'Crème capillaire') // rupture après la vente en gros
            ->assertJsonPath('data.stock_alerts.0.stock', 0)
            ->assertJsonStructure(['data' => ['revenue_today', 'revenue_month', 'orders_to_process', 'bookings_today', 'agenda', 'top_products', 'recent_orders']]);
        $this->assertIsInt($this->getJson('/api/v1/admin/dashboard')->json('data.revenue_month'));
    }

    public function test_l_utilisateur_connecte_expose_ses_permissions_pour_les_menus(): void
    {
        $this->actingAs($this->staff('stylist'))->getJson('/api/v1/auth/me')->assertJsonPath('data.permissions', ['bookings.view']);
    }

    // ---------- Commandes : machine à états ----------

    public function test_cycle_de_vie_d_un_retrait_en_boutique(): void
    {
        $this->actingAs($this->admin);
        foreach (['preparing', 'ready', 'delivered'] as $status) {
            $this->patchJson('/api/v1/admin/orders/CMD-2026-000102/status', ['status' => $status])->assertOk()->assertJsonPath('data.status', $status);
        }
        $this->assertNotNull(Order::where('reference', 'CMD-2026-000102')->value('delivered_at'));
        $this->getJson('/api/v1/admin/orders/CMD-2026-000102')->assertJsonPath('data.allowed_transitions', []); // état final
    }

    public function test_transition_interdite_refusee(): void
    {
        $this->actingAs($this->admin)->patchJson('/api/v1/admin/orders/CMD-2026-000102/status', ['status' => 'shipped'])
            ->assertUnprocessable()->assertJsonPath('errors.status.0', 'Passage impossible de « Confirmée » à « En livraison ».');
    }

    public function test_annuler_exige_un_motif_et_remet_le_stock(): void
    {
        $this->actingAs($this->admin);
        $this->patchJson('/api/v1/admin/orders/CMD-2026-000009/status', ['status' => 'cancelled'])->assertJsonValidationErrors(['reason']);
        $this->patchJson('/api/v1/admin/orders/CMD-2026-000009/status', ['status' => 'cancelled', 'reason' => 'Revendeur a annulé'])->assertOk();

        $creme = Product::where('sku', 'DAB-CRE-001')->first();
        $this->assertSame(96, $creme->stock_quantity); // 0 + 96 remis en stock
        $this->assertDatabaseHas('stock_movements', ['product_id' => $creme->id, 'type' => 'sale_cancellation', 'quantity' => 96]);
    }

    // ---------- Paiement et factures ----------

    public function test_encaisser_emet_une_facture_numerotee_sans_trou(): void
    {
        $this->actingAs($this->admin);
        $this->postJson('/api/v1/admin/orders/CMD-2026-000102/payments', ['method' => 'wave', 'provider_reference' => 'WAVE-123'])->assertOk()
            ->assertJsonPath('data.payment_status', 'paid')
            ->assertJsonPath('data.invoice_number', 'FAC-2026-000001')
            ->assertJsonPath('data.payments.0.amount', 6000); // montant pris dans la COMMANDE
        $this->postJson('/api/v1/admin/orders/CMD-2026-000009/payments', ['method' => 'cash'])->assertJsonPath('data.invoice_number', 'FAC-2026-000002');

        $this->postJson('/api/v1/admin/orders/CMD-2026-000102/payments', ['method' => 'cash'])->assertUnprocessable(); // déjà payée
        $this->patchJson('/api/v1/admin/orders/CMD-2026-000009/status', ['status' => 'cancelled', 'reason' => 'x'])
            ->assertJsonPath('errors.status.0', 'Commande déjà payée : il faut d’abord la rembourser (avoir).');
    }

    public function test_facture_pdf_pour_le_personnel_et_pour_le_client_proprietaire_uniquement(): void
    {
        $this->actingAs($this->admin)->postJson('/api/v1/admin/orders/CMD-2026-000102/payments', ['method' => 'cash'])->assertOk();

        $pdf = $this->get('/api/v1/admin/invoices/FAC-2026-000001/pdf')->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', $pdf->getContent()); // signature d'un vrai fichier PDF

        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->actingAs(User::where('email', 'mariama@client.test')->first(), 'web')
            ->get('/api/v1/me/orders/CMD-2026-000102/invoice')->assertOk()->assertHeader('content-type', 'application/pdf');

        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->actingAs(User::factory()->create(), 'web')->getJson('/api/v1/me/orders/CMD-2026-000102/invoice')->assertForbidden();
    }

    // ---------- Réservations ----------

    public function test_planning_et_transitions_des_reservations(): void
    {
        $this->actingAs($this->admin);
        $from = now()->toDateString();
        $to = now()->addDays(15)->toDateString();
        $this->getJson("/api/v1/admin/bookings?from={$from}&to={$to}")->assertOk()->assertJsonPath('data.0.reference', 'RDV-2026-000201');

        // Pas encore eu lieu : impossible de le marquer terminé
        $this->patchJson('/api/v1/admin/bookings/RDV-2026-000201/status', ['status' => 'completed'])
            ->assertJsonPath('errors.status.0', 'Ce rendez-vous n’a pas encore eu lieu.');
        $this->patchJson('/api/v1/admin/bookings/RDV-2026-000201/status', ['status' => 'cancelled', 'reason' => 'Coiffeuse malade'])
            ->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertSame('staff', Booking::where('reference', 'RDV-2026-000201')->value('cancelled_by'));
    }

    // ---------- Stock et fabrication ----------

    public function test_nouveau_lot_cout_unitaire_calcule_et_stock_augmente(): void
    {
        $spray = Product::where('sku', 'DAB-SAC-001')->first(); // spray anti-chute : 72 en stock, coût inconnu
        $this->actingAs($this->admin)->postJson('/api/v1/admin/production-batches', [
            'product_id' => $spray->id, 'batch_number' => 'LOT-2611-SAC', 'quantity_produced' => 96,
            'produced_on' => now()->toDateString(), 'expires_on' => now()->addYear()->toDateString(),
            'costs' => [['category' => 'ingredients', 'label' => 'Huiles essentielles', 'amount' => 15000], ['category' => 'packaging', 'label' => 'Flacons spray', 'amount' => 10000]],
        ])->assertCreated()->assertJsonPath('data.unit_cost', 260.42); // 25 000 / 96

        $spray->refresh();
        $this->assertSame(168, $spray->stock_quantity);
        $this->assertSame('260.42', (string) $spray->cost_price);

        $this->postJson('/api/v1/admin/production-batches', ['product_id' => $spray->id, 'batch_number' => 'LOT-2611-SAC', 'quantity_produced' => 1, 'produced_on' => now()->toDateString()])
            ->assertJsonPath('errors.batch_number.0', 'Ce numéro de lot existe déjà.');
    }

    public function test_une_perte_exige_un_motif_est_toujours_une_sortie_et_est_auditee(): void
    {
        $masque = Product::where('sku', 'DAB-MAS-001')->first(); // 24
        $this->actingAs($this->admin);
        $this->postJson("/api/v1/admin/products/{$masque->id}/stock-adjustments", ['type' => 'loss', 'quantity' => 2])->assertJsonValidationErrors(['reason']);
        $this->postJson("/api/v1/admin/products/{$masque->id}/stock-adjustments", ['type' => 'loss', 'quantity' => 2, 'reason' => 'Pots fissurés'])
            ->assertCreated()->assertJsonPath('data.stock_quantity', 22); // « 2 » saisi -> -2 appliqué

        $this->assertTrue(Activity::where('log_name', 'stock')->where('subject_id', $masque->id)->exists());
    }

    public function test_changer_un_prix_est_trace_avec_avant_et_apres(): void
    {
        $serum = Product::where('sku', 'DAB-SBO-030')->first();
        $this->actingAs($this->admin)->patchJson("/api/v1/admin/products/{$serum->id}", ['price' => 3500])->assertOk()
            ->assertJsonPath('data.price', 3500)->assertJsonPath('data.margin_rate', 92.4);

        $log = Activity::where('log_name', 'products')->where('subject_id', $serum->id)->latest('id')->first();
        $this->assertSame($this->admin->id, $log->causer_id);
        $this->assertSame(3000, $log->properties['old']['price']);
        $this->assertSame(3500, $log->properties['attributes']['price']);
        $this->getJson('/api/v1/admin/audit?log=products')->assertOk()->assertJsonPath('data.0.causer', 'Awa Ndiaye')
            ->assertJsonPath('data.0.subject_label', $serum->displayName()); // libellé lisible, pas « Product #3 »
    }

    // ---------- Clients et équipe ----------

    public function test_fichier_clients_avec_valeur_vie_client(): void
    {
        // Mariama : commande payée 12 000 + prestation terminée 8 000
        $this->actingAs($this->admin)->getJson('/api/v1/admin/customers?search=Mariama')->assertOk()
            ->assertJsonPath('data.0.total_spent', 20000)->assertJsonPath('data.0.has_account', true);
        $this->getJson('/api/v1/admin/customers?type=reseller')->assertJsonPath('meta.total', 1);
    }

    public function test_gestion_du_personnel_et_garde_fou_sur_ses_propres_droits(): void
    {
        $this->actingAs($this->admin);
        $this->postJson('/api/v1/admin/users', ['first_name' => 'Ibou', 'last_name' => 'Diallo', 'email' => 'ibou@dabohair.test', 'role' => 'cashier', 'password' => 'faible'])
            ->assertJsonValidationErrors(['password']);
        $id = $this->postJson('/api/v1/admin/users', ['first_name' => 'Ibou', 'last_name' => 'Diallo', 'email' => 'ibou@dabohair.test', 'role' => 'cashier', 'password' => 'Caisse2026Dakar'])
            ->assertCreated()->assertJsonPath('data.role', 'cashier')->json('data.id');
        $this->patchJson("/api/v1/admin/users/{$id}", ['role' => 'manager', 'is_active' => false])->assertOk()
            ->assertJsonPath('data.role', 'manager')->assertJsonPath('data.is_active', false);

        $this->patchJson("/api/v1/admin/users/{$this->admin->id}", ['role' => 'cashier'])
            ->assertUnprocessable()->assertJsonPath('message', 'Vous ne pouvez pas retirer vos propres droits d’administration.');
        $this->getJson('/api/v1/admin/roles')->assertOk()->assertJsonFragment(['name' => 'stylist', 'permissions' => ['bookings.view']]);
    }
}
