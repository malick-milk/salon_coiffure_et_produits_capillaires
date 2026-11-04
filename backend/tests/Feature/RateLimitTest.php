<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Anti-abus (RG-RES-07) : un robot ne doit pas pouvoir inonder le salon de fausses réservations */
class RateLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_les_limites_par_defaut_sont_les_valeurs_protectrices(): void
    {
        $this->assertSame(20, config('app.rate_limits.checkout'));
        $this->assertSame(120, config('app.rate_limits.api'));
    }

    public function test_au_dela_de_20_reservations_ou_commandes_par_heure_la_meme_adresse_est_bloquee(): void
    {
        // Même invalide (422), chaque tentative compte : sinon un robot pourrait tester sans limite
        for ($i = 1; $i <= 20; $i++) {
            $this->postJson($i % 2 ? '/api/v1/bookings' : '/api/v1/orders', [])->assertUnprocessable();
        }
        $this->postJson('/api/v1/bookings', [])->assertStatus(429);
        $this->postJson('/api/v1/orders', [])->assertStatus(429); // la limite est commune aux deux

        // Une autre adresse IP n'est pas concernée
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.2'])->postJson('/api/v1/bookings', [])->assertUnprocessable();
        // La lecture du catalogue reste possible
        $this->getJson('/api/v1/products')->assertOk();
    }
}
