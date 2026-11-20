<?php

namespace Tests\Feature;

use App\Models\ErrorReport;
use App\Notifications\SiteErrorAlert;
use App\Services\Monitoring\ErrorReporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

/** Suivi des erreurs hébergé sur notre serveur (21 novembre 2026) */
class ErrorReportingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        config(['services.alerts.email' => 'proprietaire@dabohair.test']);
        Route::get('/api/v1/__test-panne', fn () => throw new RuntimeException('Panne de test pour mariama@client.test au 77 123 45 67'));
    }

    public function test_une_erreur_serveur_est_enregistree_masquee_et_signalee_une_fois_par_heure(): void
    {
        $this->getJson('/api/v1/__test-panne')->assertStatus(500)->assertJsonMissing(['Panne de test']); // rien de technique pour la visiteuse
        $this->getJson('/api/v1/__test-panne')->assertStatus(500);

        $report = ErrorReport::sole();
        $this->assertSame(['server', RuntimeException::class, 2], [$report->source, $report->type, $report->occurrences]);
        $this->assertSame('Panne de test pour [e-mail] au [téléphone]', $report->message); // données personnelles masquées
        Notification::assertSentOnDemandTimes(SiteErrorAlert::class, 1); // 2 apparitions, 1 seul e-mail
        Notification::assertSentOnDemand(SiteErrorAlert::class, fn ($n, $channels, AnonymousNotifiable $to) => $to->routes['mail'] === 'proprietaire@dabohair.test');

        $this->travel(61)->minutes();
        $this->getJson('/api/v1/__test-panne');
        Notification::assertSentOnDemandTimes(SiteErrorAlert::class, 2); // une heure plus tard : nouvel e-mail
    }

    public function test_les_erreurs_ordinaires_ne_sont_pas_signalees(): void
    {
        $this->getJson('/api/v1/products/inexistant')->assertNotFound();
        $this->postJson('/api/v1/orders', [])->assertUnprocessable();
        $this->getJson('/api/v1/me/orders')->assertUnauthorized();

        $this->assertSame(0, ErrorReport::count());
        Notification::assertNothingSent();
    }

    public function test_erreur_du_navigateur_page_sans_parametres_et_limites(): void
    {
        $this->postJson('/api/v1/client-errors', ['type' => 'TypeError', 'message' => 'x is undefined', 'page' => '/desinscription?token=abc123secret', 'stack' => "at Panier (panier.js:10)\nat App"])
            ->assertNoContent();
        $report = ErrorReport::sole();
        $this->assertSame(['browser', '/desinscription', 'at Panier (panier.js:10)'], [$report->source, $report->location, $report->context['stack'][0]]);

        $this->postJson('/api/v1/client-errors', ['type' => 'x', 'message' => str_repeat('a', 1001)])->assertUnprocessable();
        for ($i = 0; $i < 20; $i++) {
            $this->postJson('/api/v1/client-errors', ['type' => 'TypeError', 'message' => 'boucle']);
        }
        $this->postJson('/api/v1/client-errors', ['type' => 'TypeError', 'message' => 'boucle'])->assertStatus(429); // 20 par minute et par IP
    }

    public function test_masquage_et_purge(): void
    {
        $this->assertSame('jeton [jeton], [masqué] : password=[masqué]', ErrorReporter::scrub('jeton '.str_repeat('a1', 20).', [masqué] : password=Secret-2026'));

        ErrorReport::create(['source' => 'server', 'fingerprint' => str_repeat('a', 64), 'type' => 'X', 'message' => 'vieille', 'first_seen_at' => now()->subDays(100), 'last_seen_at' => now()->subDays(91)]);
        ErrorReport::create(['source' => 'server', 'fingerprint' => str_repeat('b', 64), 'type' => 'X', 'message' => 'récente', 'first_seen_at' => now(), 'last_seen_at' => now()]);
        $this->artisan('errors:purge')->expectsOutput('1 erreur(s) effacée(s).')->assertSuccessful();
        $this->assertSame(['récente'], ErrorReport::pluck('message')->all());
    }

    public function test_sans_adresse_configuree_l_erreur_est_enregistree_sans_e_mail(): void
    {
        config(['services.alerts.email' => null]);
        $this->getJson('/api/v1/__test-panne')->assertStatus(500);

        $this->assertSame(1, ErrorReport::count());
        Notification::assertNothingSent();
    }
}
