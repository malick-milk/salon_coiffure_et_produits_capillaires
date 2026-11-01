<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Service;
use App\Models\Stylist;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/** POST /bookings (RG-RES-01, 02, 06, 08) */
class BookingApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-11-08 10:00:00', 'UTC'));
    }

    private function payload(array $override = []): array
    {
        return array_replace_recursive([
            'service_id' => Service::where('slug', 'nattes-collees')->value('id'),
            'stylist_id' => null,
            'date' => '2026-11-09',
            'time' => '14:00',
            'customer' => ['first_name' => 'Khady', 'last_name' => 'Fall', 'phone' => '76 111 22 33', 'email' => null],
            'notes' => null,
            'consent' => true,
        ], $override);
    }

    public function test_un_invite_reserve_et_recoit_une_reference_le_coiffeur_est_affecte(): void
    {
        $this->postJson('/api/v1/bookings', $this->payload())->assertCreated()
            ->assertJsonPath('data.reference', 'RDV-2026-000011')
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.stylist_name', 'Fatou') // seule Fatou fait les nattes collées
            ->assertJsonPath('data.starts_at', '2026-11-09T14:00:00')
            ->assertJsonPath('data.ends_at', '2026-11-09T15:30:00')
            ->assertJsonPath('data.price', 12000);

        // La fiche client est créée avec le téléphone NORMALISÉ
        $this->assertDatabaseHas('customers', ['phone' => '761112233', 'user_id' => null]);
        // En base, la fin inclut le battement de nettoyage (15 min)
        $this->assertSame('15:45', Booking::latest('id')->first()->ends_at->format('H:i'));
    }

    public function test_le_meme_creneau_ne_peut_pas_etre_reserve_deux_fois(): void
    {
        $before = Booking::count(); // les données de démo contiennent déjà des réservations
        $this->postJson('/api/v1/bookings', $this->payload())->assertCreated();
        $this->postJson('/api/v1/bookings', $this->payload(['customer' => ['phone' => '771234567']]))
            ->assertStatus(409)
            ->assertJsonPath('message', 'Ce créneau vient d’être réservé. Merci d’en choisir un autre.');
        $this->assertSame($before + 1, Booking::count());
    }

    public function test_peu_importe_attribue_le_second_coiffeur_quand_le_premier_est_pris(): void
    {
        $soin = Service::where('slug', 'soin-profond-karite')->value('id');
        $first = $this->postJson('/api/v1/bookings', $this->payload(['service_id' => $soin, 'time' => '10:00']))->json('data.stylist_name');
        $second = $this->postJson('/api/v1/bookings', $this->payload(['service_id' => $soin, 'time' => '10:00', 'customer' => ['phone' => '771234567']]))
            ->assertCreated()->json('data.stylist_name');
        $this->assertNotSame($first, $second);
        $this->postJson('/api/v1/bookings', $this->payload(['service_id' => $soin, 'time' => '10:00', 'customer' => ['phone' => '781234567']]))->assertStatus(409);
    }

    public function test_un_coiffeur_qui_ne_fait_pas_la_prestation_est_refuse(): void
    {
        $bineta = Stylist::where('display_name', 'Bineta')->value('id');
        $this->postJson('/api/v1/bookings', $this->payload(['stylist_id' => $bineta]))->assertStatus(409);
    }

    public function test_creneau_hors_horaires_dimanche_ou_trop_proche_refuse(): void
    {
        $this->postJson('/api/v1/bookings', $this->payload(['time' => '13:00']))->assertStatus(409); // pendant la pause
        $this->postJson('/api/v1/bookings', $this->payload(['date' => '2026-11-15']))->assertStatus(409); // dimanche
        $this->travelTo(Carbon::parse('2026-11-09 13:00:00', 'UTC'));
        $this->postJson('/api/v1/bookings', $this->payload(['time' => '14:00']))->assertStatus(409); // moins de 2 h
    }

    public function test_validation_serveur_en_francais(): void
    {
        $response = $this->postJson('/api/v1/bookings', $this->payload(['customer' => ['first_name' => '', 'phone' => '33 821 00 00'], 'consent' => false, 'time' => '25:99']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['customer.first_name', 'consent', 'time']);
        // La clé « customer.phone » contient un point : on la lit dans le tableau (assertJsonPath la couperait en deux)
        $this->assertSame('Numéro mobile invalide (exemple : 77 123 45 67).', $response->json('errors')['customer.phone'][0]);
    }

    public function test_un_client_connecte_reserve_sur_sa_propre_fiche(): void
    {
        $user = User::where('email', 'mariama@client.test')->first();
        $this->actingAs($user)->postJson('/api/v1/bookings', $this->payload(['customer' => ['phone' => '761112233']]))->assertCreated();

        $this->assertSame($user->customer->id, Booking::latest('id')->first()->customer_id);
        $this->assertNull(Customer::where('phone', '761112233')->first()); // pas de fiche « invité » créée
    }
}
