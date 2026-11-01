<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Espace client : réservations (annulation RG-RES-04) et profil */
class AccountApiTest extends TestCase
{
    use RefreshDatabase;

    private User $mariama;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mariama = User::where('email', 'mariama@client.test')->first();
    }

    public function test_liste_des_reservations_avec_droit_d_annulation_calcule(): void
    {
        $this->actingAs($this->mariama)->getJson('/api/v1/me/bookings')->assertOk()
            ->assertJsonPath('data.0.reference', 'RDV-2026-000201')
            ->assertJsonPath('data.0.can_cancel', true)   // dans 10 jours
            ->assertJsonPath('data.1.can_cancel', false); // terminée
    }

    public function test_annulation_a_plus_de_24h_libere_le_creneau(): void
    {
        $this->actingAs($this->mariama)->postJson('/api/v1/me/bookings/RDV-2026-000201/cancel')->assertOk()
            ->assertJsonPath('data.status', 'cancelled')->assertJsonPath('data.can_cancel', false);

        $booking = Booking::where('reference', 'RDV-2026-000201')->first();
        $this->assertNull($booking->active_slot); // colonne générée : le créneau n'est plus bloqué
        $this->assertSame('customer', $booking->cancelled_by);
    }

    public function test_annulation_refusee_a_moins_de_24h(): void
    {
        Booking::where('reference', 'RDV-2026-000201')->update(['starts_at' => now()->addHours(5), 'ends_at' => now()->addHours(8)]);
        $this->actingAs($this->mariama)->postJson('/api/v1/me/bookings/RDV-2026-000201/cancel')
            ->assertUnprocessable()->assertJsonPath('message', 'Annulation impossible à moins de 24 h du rendez-vous. Merci d’appeler le salon.');
    }

    public function test_impossible_d_annuler_la_reservation_d_un_autre_client(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/api/v1/me/bookings/RDV-2026-000201/cancel')->assertForbidden();
        $this->assertSame('confirmed', Booking::where('reference', 'RDV-2026-000201')->first()->status->value);
    }

    public function test_mise_a_jour_du_profil(): void
    {
        $this->actingAs($this->mariama)->patchJson('/api/v1/me/profile', ['first_name' => 'Mariama', 'last_name' => 'Sow', 'phone' => '78 555 44 33'])
            ->assertOk()->assertJsonPath('data.phone', '785554433');
        // Garder son propre numéro est permis ; prendre celui d'un autre, non
        $this->patchJson('/api/v1/me/profile', ['first_name' => 'Mariama', 'last_name' => 'Sow', 'phone' => '785554433'])->assertOk();
        $this->patchJson('/api/v1/me/profile', ['first_name' => 'Mariama', 'last_name' => 'Sow', 'phone' => '770000001'])
            ->assertUnprocessable()->assertJsonPath('errors.phone.0', 'Ce numéro est déjà utilisé.');
    }
}
