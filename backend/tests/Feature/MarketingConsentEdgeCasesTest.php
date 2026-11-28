<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerConsent;
use App\Models\Product;
use App\Models\User;
use App\Services\Customers\MarketingConsent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * QA du 28 novembre 2026 : cas limites de l'accord pour les offres par e-mail
 * (cliente déjà d'accord, invitée puis inscrite, +221, retrait puis ré-accord, sécurité, montants cachés).
 */
class MarketingConsentEdgeCasesTest extends TestCase
{
    use RefreshDatabase;

    private function guestOrder(string $phone, bool $marketing, array $customer = []): TestResponse
    {
        return $this->postJson('/api/v1/orders', ['items' => [['product_id' => Product::where('sku', 'DAB-SPH-250')->value('id'), 'quantity' => 1]],
            'fulfillment_method' => 'pickup', 'delivery_zone_id' => null,
            'customer' => ['first_name' => 'Inconnue', 'last_name' => 'Test', 'phone' => $phone, 'email' => null, ...$customer],
            'shipping_address' => null, 'notes' => null, 'consent' => true, 'marketing_consent' => $marketing]);
    }

    private function as(string $roleOrEmail): User
    {
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $user = str_contains($roleOrEmail, '@') ? User::where('email', $roleOrEmail)->firstOrFail()
            : tap(User::factory()->create(['first_name' => 'Awa', 'last_name' => ucfirst($roleOrEmail)]))->assignRole($roleOrEmail);
        $this->actingAs($user);

        return $user;
    }

    private function mariama(): Customer
    {
        return Customer::where('phone', '770000003')->firstOrFail();
    }

    public function test_cliente_connectee_deja_d_accord_qui_commande_en_cochant_aucune_preuve_en_double(): void
    {
        $this->as('mariama@client.test');
        $this->patchJson('/api/v1/me/preferences', ['marketing_email' => true])->assertOk();
        $this->guestOrder('77 000 00 03', true)->assertCreated();
        $this->guestOrder('77 000 00 03', false)->assertCreated(); // case vide : ne retire rien
        $this->assertTrue($this->mariama()->fresh()->marketing_consent);
        $this->assertSame(['account'], CustomerConsent::pluck('source')->all());
    }

    public function test_invitee_coche_a_la_commande_avec_plus_221_puis_s_inscrit_sans_cocher(): void
    {
        $this->guestOrder('+221 78 444 55 66', true, ['first_name' => 'Fatou'])->assertCreated();
        $this->assertSame(1, Customer::where('phone', '784445566')->count());

        $this->postJson('/api/v1/auth/register', ['first_name' => 'Fatou', 'phone' => '784445566', 'password' => 'Soleil-Dakar-2026',
            'password_confirmation' => 'Soleil-Dakar-2026', 'consent' => true])->assertCreated();
        $this->assertSame(1, Customer::where('phone', '784445566')->count(), 'pas de 2e fiche à l’inscription');
        $customer = Customer::where('phone', '784445566')->sole();
        $this->assertNotNull($customer->user_id);
        $this->assertTrue($customer->marketing_consent, 'l’accord donné à la commande reste');
        $this->getJson('/api/v1/me/preferences')->assertOk()->assertJsonPath('data.marketing_email', true)->assertJsonPath('data.last_change.source', 'order');
    }

    public function test_invitee_coche_a_l_inscription_avec_le_numero_d_une_fiche_invitee_existante(): void
    {
        $this->guestOrder('78 444 55 67', false)->assertCreated();
        $this->postJson('/api/v1/auth/register', ['first_name' => 'Fatou', 'phone' => '+221784445567', 'password' => 'Soleil-Dakar-2026',
            'password_confirmation' => 'Soleil-Dakar-2026', 'consent' => true, 'marketing_consent' => true])->assertCreated();
        $customer = Customer::where('phone', '784445567')->sole();
        $this->assertTrue($customer->marketing_consent);
        $this->assertSame('register', CustomerConsent::where('customer_id', $customer->id)->sole()->source);
    }

    public function test_retrait_puis_re_accord_garde_toute_la_preuve_et_l_erp_suit(): void
    {
        $this->as('mariama@client.test');
        $this->patchJson('/api/v1/me/preferences', ['marketing_email' => true])->assertOk();
        $this->patchJson('/api/v1/me/preferences', ['marketing_email' => false])->assertOk();
        $this->patchJson('/api/v1/me/preferences', ['marketing_email' => false])->assertOk(); // même état : pas de ligne
        $this->as('admin@dabohair.test');
        $row = collect($this->getJson('/api/v1/admin/customers?search=770000003')->json('data'))->sole();
        $this->assertSame('withdrawn', $row['marketing']['status']);
        $this->postJson("/api/v1/admin/customers/{$row['id']}/marketing-consent")->assertOk()->assertJsonPath('data.marketing.status', 'yes');
        $this->assertSame([[true, 'account'], [false, 'account'], [true, 'salon']],
            CustomerConsent::orderBy('id')->get()->map(fn ($c) => [$c->granted, $c->source])->all());
    }

    public function test_une_cliente_ne_peut_pas_changer_les_preferences_d_une_autre(): void
    {
        $other = Customer::where('id', '!=', $this->mariama()->id)->firstOrFail();
        $before = [$other->marketing_consent, $other->resserrage_opt_out];
        $this->as('mariama@client.test');
        $this->patchJson('/api/v1/me/preferences', ['marketing_email' => true, 'resserrage_reminders' => false, 'customer_id' => $other->id, 'customer' => $other->id])->assertOk();
        $this->assertSame($before, [$other->fresh()->marketing_consent, $other->fresh()->resserrage_opt_out]);
        $this->assertSame([$this->mariama()->id], CustomerConsent::pluck('customer_id')->all());
    }

    public function test_preferences_sans_connexion_401_et_valeurs_invalides_422(): void
    {
        $this->getJson('/api/v1/me/preferences')->assertUnauthorized();
        $this->patchJson('/api/v1/me/preferences', ['marketing_email' => true])->assertUnauthorized();
        $this->as('mariama@client.test');
        $this->patchJson('/api/v1/me/preferences', ['marketing_email' => 'peut-être'])->assertUnprocessable()->assertJsonValidationErrors('marketing_email');
        $this->assertSame(0, CustomerConsent::count());
    }

    public function test_lien_de_desinscription_sans_signature_ou_signature_modifiee_refuse(): void
    {
        $customer = $this->mariama();
        MarketingConsent::record($customer, true, 'account');
        $this->postJson("/api/v1/offers/unsubscribe/{$customer->id}")->assertForbidden();
        $this->postJson("/api/v1/offers/unsubscribe/{$customer->id}?signature=".str_repeat('a', 64))->assertForbidden();
        // le lien des RAPPELS ne retire pas l'accord aux OFFRES (deux signatures différentes)
        $reminders = URL::signedRoute('reminders.unsubscribe', ['customer' => $customer->id], absolute: false);
        $this->postJson(str_replace('/reminders/', '/offers/', $reminders))->assertForbidden();
        $this->assertTrue($customer->fresh()->marketing_consent);
    }

    public function test_la_caisse_ne_recoit_aucun_montant_quel_que_soit_le_filtre(): void
    {
        $this->as('cashier');
        foreach (['', '?marketing=1', '?search=Mariama', '?type=individual', '?page=2'] as $q) {
            $res = $this->getJson('/api/v1/admin/customers'.$q)->assertOk();
            $this->assertFalse($res->json('meta.can_see_amounts'));
            foreach ($res->json('data') as $row) {
                $this->assertNull($row['total_spent'], "montant visible pour la caisse ($q)");
            }
        }
        $res = $this->postJson("/api/v1/admin/customers/{$this->mariama()->id}/marketing-consent")->assertOk();
        $this->assertStringNotContainsString('spent', $res->getContent());
    }

    public function test_seuls_les_roles_autorises_notent_un_accord(): void
    {
        $id = $this->mariama()->id;
        $this->postJson("/api/v1/admin/customers/{$id}/marketing-consent")->assertUnauthorized();
        foreach (['stylist', 'stock_keeper'] as $role) {
            $this->as($role);
            $this->postJson("/api/v1/admin/customers/{$id}/marketing-consent")->assertForbidden();
            $this->getJson('/api/v1/admin/customers')->assertForbidden();
        }
        $this->as('mariama@client.test');
        $this->postJson("/api/v1/admin/customers/{$id}/marketing-consent")->assertForbidden();
        $this->as('manager');
        $this->postJson("/api/v1/admin/customers/{$id}/marketing-consent")->assertOk();
        $this->assertSame(1, CustomerConsent::count());
    }

    public function test_liste_erp_nombre_de_requetes_constant(): void
    {
        $this->as('admin@dabohair.test');
        $count = function (): int {
            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->getJson('/api/v1/admin/customers')->assertOk();
            $n = count(DB::getQueryLog());
            DB::disableQueryLog();

            return $n;
        };
        $admin = User::where('email', 'admin@dabohair.test')->first();
        MarketingConsent::record(Customer::query()->firstOrFail(), true, 'salon', $admin); // 1 preuve avec caisse : charge aussi « recorder »
        $count(); // 1er appel : permissions mises en cache
        $before = $count();
        Customer::query()->get()->each(fn (Customer $c) => MarketingConsent::record($c, true, 'salon', $admin) && MarketingConsent::record($c, false, 'account'));
        $this->assertSame($before, $count(), 'N+1 : la liste fait plus de requêtes quand les clientes ont des preuves');
    }

    /**
     * BUG (QA 28/11/2026) : une visiteuse NON connectée qui tape le numéro d'une cliente INSCRITE et coche la case
     * donne l'accord aux offres À SA PLACE (et annule son retrait). Le consentement doit venir de la personne
     * (loi n° 2008-12) ; une inscrite choisit dans son espace client. Attendu : rien ne change pour la fiche inscrite.
     */
    public function test_bug_une_visiteuse_ne_peut_pas_donner_l_accord_a_la_place_d_une_cliente_inscrite(): void
    {
        $this->as('mariama@client.test');
        $this->patchJson('/api/v1/me/preferences', ['marketing_email' => true])->assertOk();
        $this->patchJson('/api/v1/me/preferences', ['marketing_email' => false])->assertOk(); // Mariama a RETIRÉ son accord

        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->guestOrder('+221 77 000 00 03', true)->assertCreated(); // une autre personne, avec le numéro de Mariama

        $this->assertFalse($this->mariama()->fresh()->marketing_consent, 'une inconnue a ré-abonné Mariama aux offres');
        $this->assertSame(2, CustomerConsent::count());
    }
}
