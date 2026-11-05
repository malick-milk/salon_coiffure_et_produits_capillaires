<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Monolog\Formatter\JsonFormatter;
use RuntimeException;
use Tests\TestCase;

/** Étape 10 : chaque mesure de l'audit de sécurité (docs/10_SECURITE.md) a son test */
class SecurityAuditTest extends TestCase
{
    use RefreshDatabase;

    // ---------- A05 : en-têtes, CORS, cookies, fuite d'informations ----------

    public function test_les_reponses_portent_les_en_tetes_de_securite(): void
    {
        $response = $this->getJson('/api/v1/products')->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
        $this->assertFalse($response->headers->has('Strict-Transport-Security')); // pas en http://

        $this->getJson('https://localhost/api/v1/products')->assertHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    public function test_cors_seule_la_vitrine_peut_lire_l_api_depuis_un_navigateur(): void
    {
        $preflight = fn (string $origin) => $this->call('OPTIONS', '/api/v1/auth/me', [], [], [], [
            'HTTP_ORIGIN' => $origin, 'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
        ]);
        $this->assertSame('http://localhost:5173', $preflight('http://localhost:5173')->headers->get('Access-Control-Allow-Origin'));
        // Pour un autre site, la réponse n'autorise QUE la vitrine : le navigateur compare, voit que ce n'est pas
        // l'origine qui demande, et bloque la lecture (une seule origine autorisée = elle est toujours renvoyée)
        $this->assertNotSame('https://site-pirate.example', $preflight('https://site-pirate.example')->headers->get('Access-Control-Allow-Origin'));
        $this->assertNotSame('*', $preflight('https://site-pirate.example')->headers->get('Access-Control-Allow-Origin'));
    }

    public function test_cookie_de_session_httponly_et_jeton_csrf_lisible_par_le_site(): void
    {
        $cookies = collect($this->get('/sanctum/csrf-cookie')->headers->getCookies())->keyBy(fn ($c) => $c->getName());
        $session = $cookies[config('session.cookie')];
        $this->assertTrue($session->isHttpOnly());              // JavaScript ne peut pas le voler (XSS)
        $this->assertSame('lax', $session->getSameSite());      // pas envoyé par un formulaire d'un autre site (CSRF)
        $this->assertFalse($cookies['XSRF-TOKEN']->isHttpOnly()); // VOULU : le site le lit pour le renvoyer en en-tête
    }

    public function test_une_erreur_serveur_ne_revele_rien_en_production(): void
    {
        config(['app.debug' => false]);
        Route::get('/api/v1/_test-erreur', fn () => throw new RuntimeException('SQLSTATE[HY000] mot de passe root_dev_password'));

        $body = $this->getJson('/api/v1/_test-erreur')->assertStatus(500)->getContent();
        $this->assertStringNotContainsString('SQLSTATE', $body);
        $this->assertStringNotContainsString('root_dev_password', $body);
        $this->assertStringNotContainsString('trace', $body);
    }

    // ---------- A01 : contrôle d'accès ----------

    public function test_route_protegee_sans_en_tete_json_repond_401_et_non_500(): void
    {
        // Un robot ou une adresse tapée dans le navigateur n'envoie pas « Accept: application/json »
        $this->get('/api/v1/admin/dashboard')->assertUnauthorized()->assertJsonPath('message', 'Non authentifié.');
        $this->get('/api/v1/me/orders')->assertUnauthorized();
    }

    public function test_chaque_route_d_administration_exige_une_connexion_et_une_permission(): void
    {
        $admin = collect(Route::getRoutes()->getRoutes())->filter(fn ($r) => str_starts_with($r->uri(), 'api/v1/admin'));
        $this->assertGreaterThan(20, $admin->count());
        foreach ($admin as $route) {
            $middleware = $route->gatherMiddleware();
            $this->assertContains('auth:sanctum', $middleware, $route->uri());
            $this->assertNotEmpty(array_filter($middleware, fn ($m) => str_starts_with($m, 'permission:')), "Route sans permission : {$route->methods()[0]} {$route->uri()}");
        }
    }

    public function test_impossible_de_s_inscrire_avec_un_role_ou_un_statut_choisi(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'first_name' => 'Pirate', 'last_name' => 'Test', 'email' => 'pirate@test.sn', 'phone' => '771234599',
            'password' => 'Motdepasse2026', 'password_confirmation' => 'Motdepasse2026', 'consent' => true,
            'role' => 'super_admin', 'roles' => ['super_admin'], 'permissions' => ['users.manage'], 'is_active' => false, 'id' => 1,
        ])->assertCreated();

        $user = User::where('email', 'pirate@test.sn')->first();
        $this->assertSame(['customer'], $user->getRoleNames()->all());
        $this->assertTrue($user->is_active);
        $this->assertNotSame(1, $user->id);
    }

    // ---------- A07 : authentification ----------

    public function test_mot_de_passe_trop_faible_refuse_a_l_inscription(): void
    {
        $register = fn (string $password) => $this->postJson('/api/v1/auth/register', [
            'first_name' => 'Awa', 'last_name' => 'Diop', 'email' => 'awa.'.md5($password).'@test.sn', 'phone' => '7612345'.random_int(10, 99),
            'password' => $password, 'password_confirmation' => $password, 'consent' => true,
        ]);
        $register('12345678')->assertJsonValidationErrors(['password']);   // pas de lettre
        $register('motdepasse')->assertJsonValidationErrors(['password']); // pas de chiffre
        $register('court1')->assertJsonValidationErrors(['password']);     // trop court
        $register('Senegal2026')->assertCreated();
    }

    // ---------- A09 : journal de sécurité ----------

    public function test_les_echecs_de_connexion_et_les_acces_refuses_sont_journalises_sans_secret(): void
    {
        $file = storage_path('framework/testing/security-'.uniqid().'.log');
        config(['logging.channels.security' => ['driver' => 'single', 'path' => $file, 'level' => 'info', 'formatter' => JsonFormatter::class]]);
        Log::forgetChannel('security');

        $this->postJson('/api/v1/auth/login', ['email' => 'mariama@client.test', 'password' => 'MauvaisMotDePasse99']);
        $this->actingAs(User::where('email', 'mariama@client.test')->first())->getJson('/api/v1/admin/dashboard')->assertForbidden();

        $lines = array_map(fn ($l) => json_decode($l, true), file($file));
        $this->assertSame(['login.failed', 'access.denied'], array_column($lines, 'message'));
        $this->assertSame('m***@client.test', $lines[0]['context']['email']);         // email masqué
        $this->assertSame('/api/v1/admin/dashboard', $lines[1]['context']['path']);
        $this->assertStringNotContainsString('MauvaisMotDePasse99', file_get_contents($file)); // jamais de mot de passe
        @unlink($file);
    }

    // ---------- Contrôle de la configuration de production ----------

    public function test_le_controle_de_configuration_bloque_une_mise_en_production_dangereuse(): void
    {
        // La base de démonstration (comptes de test, debug) : refus attendu
        $this->artisan('app:security-check')->expectsOutputToContain('Aucun compte de démonstration')->assertFailed();
    }
}
