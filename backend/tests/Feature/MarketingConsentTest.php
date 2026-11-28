<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerConsent;
use App\Models\Product;
use App\Models\Service;
use App\Models\User;
use App\Services\Customers\MarketingConsent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Accord pour les offres par e-mail (maquette validée le 28 novembre 2026, loi n° 2008-12) */
class MarketingConsentTest extends TestCase
{
    use RefreshDatabase;

    private function register(array $over = []): TestResponse
    {
        return $this->postJson('/api/v1/auth/register', ['first_name' => 'Aïda', 'phone' => '77 555 44 33', 'password' => 'Soleil-Dakar-2026', 'password_confirmation' => 'Soleil-Dakar-2026', 'consent' => true, ...$over]);
    }

    private function actingAsRole(string $role): User
    {
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $user = tap(User::factory()->create(['first_name' => 'Khady', 'last_name' => 'Caisse']))->assignRole($role);
        $this->actingAs($user);

        return $user;
    }

    public function test_la_case_est_facultative_et_l_accord_est_prouve(): void
    {
        $this->register()->assertCreated(); // sans la case : inscription acceptée
        $this->assertFalse(Customer::where('phone', '775554433')->first()->marketing_consent);
        $this->assertSame(0, CustomerConsent::count());

        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->register(['phone' => '77 555 44 34', 'marketing_consent' => true])->assertCreated();
        $customer = Customer::where('phone', '775554434')->first();
        $this->assertTrue($customer->marketing_consent);
        $proof = CustomerConsent::sole();
        $this->assertSame([true, 'register', MarketingConsent::VERSION, null], [$proof->granted, $proof->source, $proof->text_version, $proof->recorded_by]);
        $this->assertNotNull($proof->created_at);
    }

    public function test_la_politique_de_confidentialite_reste_obligatoire_mais_pas_les_offres(): void
    {
        $this->register(['consent' => false, 'marketing_consent' => true])->assertUnprocessable()->assertJsonValidationErrors('consent');
        $this->assertSame(0, CustomerConsent::count());
    }

    public function test_commande_et_reservation_cochent_l_accord_sans_jamais_le_retirer(): void
    {
        $customer = ['first_name' => 'Ndèye', 'last_name' => 'Faye', 'phone' => '78 333 22 11', 'email' => null];
        $order = fn (bool $m) => $this->postJson('/api/v1/orders', ['items' => [['product_id' => Product::where('sku', 'DAB-SPH-250')->value('id'), 'quantity' => 1]],
            'fulfillment_method' => 'pickup', 'delivery_zone_id' => null, 'customer' => $customer, 'shipping_address' => null, 'notes' => null, 'consent' => true, 'marketing_consent' => $m]);
        $order(true)->assertCreated();
        $c = Customer::where('phone', '783332211')->first();
        $this->assertTrue($c->marketing_consent);
        $this->assertSame('order', CustomerConsent::sole()->source);
        $order(false)->assertCreated(); // case non cochée à la 2e commande : l'accord reste
        $this->assertTrue($c->fresh()->marketing_consent);
        $this->assertSame(1, CustomerConsent::count());

        $service = Service::where('slug', 'twist-simple')->first();
        $date = now()->addDays(3)->toDateString();
        $time = collect($this->getJson("/api/v1/availability?service_id={$service->id}&date={$date}")->json('data.slots'))->firstWhere('available', true)['time'];
        $this->postJson('/api/v1/bookings', ['service_id' => $service->id, 'stylist_id' => null, 'date' => $date, 'time' => $time,
            'customer' => ['first_name' => 'Awa', 'last_name' => 'Sy', 'phone' => '70 111 22 33', 'email' => null], 'notes' => null, 'consent' => true, 'marketing_consent' => true])->assertCreated();
        $this->assertSame('booking', CustomerConsent::where('customer_id', Customer::where('phone', '701112233')->value('id'))->sole()->source);
    }

    public function test_espace_client_choisir_ses_messages_et_retirer_l_accord(): void
    {
        $this->actingAs(User::where('email', 'mariama@client.test')->first());
        $this->getJson('/api/v1/me/preferences')->assertOk()->assertJsonPath('data.resserrage_reminders', true)->assertJsonPath('data.marketing_email', false)
            ->assertJsonPath('data.marketing_text', MarketingConsent::TEXT);

        $this->patchJson('/api/v1/me/preferences', ['marketing_email' => true])->assertOk()->assertJsonPath('data.marketing_email', true)->assertJsonPath('data.last_change.source', 'account');
        $this->patchJson('/api/v1/me/preferences', ['marketing_email' => false, 'resserrage_reminders' => false])->assertOk()
            ->assertJsonPath('data.marketing_email', false)->assertJsonPath('data.resserrage_reminders', false)->assertJsonPath('data.last_change.granted', false);
        $this->assertTrue(Customer::where('phone', '770000003')->value('resserrage_opt_out'));
        $this->assertSame([true, false], CustomerConsent::orderBy('id')->pluck('granted')->all());
    }

    public function test_lien_signe_de_desinscription_et_lien_falsifie_refuse(): void
    {
        $customer = Customer::where('phone', '770000003')->first();
        MarketingConsent::record($customer, true, 'account');
        $url = MarketingConsent::unsubscribeUrl($customer);
        $this->assertStringContainsString('/offres/desinscription/'.$customer->id.'?', $url);

        $api = '/api/v1/offers/unsubscribe'.substr(parse_url($url, PHP_URL_PATH), strlen('/offres/desinscription')).'?'.parse_url($url, PHP_URL_QUERY);
        $other = Customer::where('id', '!=', $customer->id)->value('id');
        $this->postJson(preg_replace('#/unsubscribe/\d+#', "/unsubscribe/{$other}", $api))->assertForbidden();
        $this->postJson($api)->assertOk()->assertJsonPath('message', 'Vous ne recevrez plus nos nouveautés et offres par e-mail.');
        $this->assertFalse($customer->fresh()->marketing_consent);
        $this->assertSame('email_link', CustomerConsent::latest('id')->first()->source);
    }

    public function test_erp_accord_note_au_salon_avec_le_nom_et_montants_caches_a_la_caisse(): void
    {
        $cashier = $this->actingAsRole('cashier');
        $list = $this->getJson('/api/v1/admin/customers')->assertOk();
        $this->assertFalse($list->json('meta.can_see_amounts'));
        $this->assertNull($list->json('data.0.total_spent')); // la caisse ne voit PAS les montants

        $customer = Customer::where('phone', '770000003')->first();
        $this->postJson("/api/v1/admin/customers/{$customer->id}/marketing-consent")->assertOk()
            ->assertJsonPath('data.marketing.status', 'yes')->assertJsonPath('data.marketing.source', 'salon')->assertJsonPath('data.marketing.by', 'Khady Caisse');
        $this->assertSame($cashier->id, CustomerConsent::sole()->recorded_by);
        $this->postJson("/api/v1/admin/customers/{$customer->id}/marketing-consent")->assertStatus(422);
        $this->assertSame([$customer->id], collect($this->getJson('/api/v1/admin/customers?marketing=1')->json('data'))->pluck('id')->all());

        $this->actingAsRole('super_admin');
        $row = collect($this->getJson('/api/v1/admin/customers?search=Mariama')->assertOk()->json('data'))->first();
        $this->assertIsInt($row['total_spent']);
        $this->actingAsRole('stylist');
        $this->postJson("/api/v1/admin/customers/{$customer->id}/marketing-consent")->assertForbidden();
    }
}
