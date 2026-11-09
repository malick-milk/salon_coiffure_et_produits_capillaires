<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route as RouteDefinition;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Liste de contrôle de sécurité avant la mise en ligne (demandée le 9 novembre 2026).
 * Chaque test correspond à une ligne de la liste ; le détail est dans docs/10_SECURITE.md §7.
 *
 * 1. Les clés restent sur le serveur
 * 2. « RLS » : chaque route protégée filtre les données côté serveur (MySQL n'a pas de RLS)
 * 3. Chaque donnée appartient à quelqu'un, et personne d'autre ne la voit
 * 4. L'administration est derrière une connexion
 * 5. L'inscription et la connexion sont limitées
 * 6. Les webhooks sont vérifiés (aucun aujourd'hui : un garde-fou bloque toute route d'écriture publique non revue)
 */
class SecurityChecklistTest extends TestCase
{
    use RefreshDatabase;

    private function repo(string $path = ''): string
    {
        return dirname(base_path()).($path ? "/{$path}" : '');
    }

    /** @return list<string> fichiers suivis par git (ce qui est publié sur GitHub) */
    private function trackedFiles(): array
    {
        exec('git -C '.escapeshellarg($this->repo()).' ls-files', $files, $code);
        $this->assertSame(0, $code, 'git ls-files a échoué');

        return $files;
    }

    // ---------- 1. Clés sur le serveur ----------

    public function test_1a_aucun_fichier_env_ni_cle_secrete_n_est_publie_sur_github(): void
    {
        $files = $this->trackedFiles();
        $envFiles = array_values(array_filter($files, fn ($f) => preg_match('#(^|/)\.env(\.|$)#', $f) && ! str_ends_with($f, '.example')));
        $this->assertSame([], $envFiles, 'Fichier .env publié : '.implode(', ', $envFiles));

        $patterns = [
            'clé Laravel' => '/APP_KEY=base64:[A-Za-z0-9+\/=]{20,}/',
            'clé privée' => '/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/',
            'clé AWS' => '/AKIA[0-9A-Z]{16}/',
            'clé de paiement' => '/sk_(live|test)_[0-9a-zA-Z]{16,}/',
            'jeton GitHub' => '/gh[pousr]_[A-Za-z0-9]{30,}/',
        ];
        $found = [];
        foreach ($files as $f) {
            if (preg_match('#\.(png|jpe?g|webp|pdf|woff2?|ico|lock)$|package-lock\.json$#', $f)) {
                continue;
            }
            $content = @file_get_contents($this->repo($f));
            foreach ($patterns as $label => $re) {
                if ($content !== false && preg_match($re, $content)) {
                    $found[] = "{$label} dans {$f}";
                }
            }
        }
        $this->assertSame([], $found);
    }

    public function test_1b_le_navigateur_ne_recoit_que_des_variables_publiques(): void
    {
        // Seules les variables VITE_ partent dans le code du navigateur : aucune ne doit être un secret
        $example = file_get_contents($this->repo('frontend/.env.example'));
        preg_match_all('/^([A-Z_]+)=/m', $example, $m);
        $this->assertSame(['VITE_ENABLE_MOCKS'], $m[1]);

        $used = [];
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->repo('frontend/src')));
        foreach ($it as $file) {
            if ($file->isFile() && preg_match('/\.(ts|tsx)$/', $file->getFilename())) {
                preg_match_all('/import\.meta\.env\.([A-Z_]+)/', file_get_contents($file->getPathname()), $mm);
                $used = [...$used, ...$mm[1]];
            }
        }
        $this->assertSame([], array_values(array_diff(array_unique($used), ['DEV', 'PROD', 'MODE', 'VITE_ENABLE_MOCKS'])));
    }

    public function test_1c_l_api_ne_renvoie_jamais_de_mot_de_passe_ni_d_empreinte_de_jeton(): void
    {
        $admin = User::where('email', 'admin@dabohair.test')->first();
        $responses = [
            $this->actingAs($admin)->getJson('/api/v1/auth/me')->assertOk()->getContent(),
            $this->getJson('/api/v1/admin/users')->assertOk()->getContent(),
            $this->getJson('/api/v1/admin/orders/CMD-2026-000102')->assertOk()->getContent(),
            $this->getJson('/api/v1/admin/customers')->assertOk()->getContent(),
        ];
        foreach ($responses as $json) {
            foreach (['password', 'remember_token', 'token_hash', 'handover_token_hash', '$2y$'] as $secret) {
                $this->assertStringNotContainsString($secret, $json);
            }
        }
    }

    // ---------- 2. Équivalent de la RLS : le filtrage est fait par le serveur ----------

    public function test_2_toute_route_qui_touche_a_des_donnees_privees_exige_une_connexion(): void
    {
        $private = collect(Route::getRoutes()->getRoutes())
            ->filter(fn (RouteDefinition $r) => preg_match('#^api/v1/(me|admin|auth/(me|logout))#', $r->uri()));
        $this->assertGreaterThan(40, $private->count());
        foreach ($private as $route) {
            $this->assertContains('auth:sanctum', $route->gatherMiddleware(), "Route privée sans connexion : {$route->uri()}");
        }
    }

    // ---------- 3. À qui appartient chaque donnée ----------

    public function test_3a_une_cliente_ne_voit_ni_les_commandes_ni_les_factures_ni_les_rendez_vous_d_une_autre(): void
    {
        $other = User::factory()->create(['email' => 'khady@client.test']);
        $other->assignRole('customer');
        Customer::create(['user_id' => $other->id, 'first_name' => 'Khady', 'last_name' => 'Fall', 'phone' => '761112233', 'email' => 'khady@client.test']);
        $mariamaOrders = Order::query()->whereHas('customer', fn ($q) => $q->where('email', 'mariama@client.test'))->pluck('reference');
        $this->assertNotEmpty($mariamaOrders);

        $this->actingAs($other);
        $this->getJson('/api/v1/me/orders')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/me/bookings')->assertOk()->assertJsonCount(0, 'data');
        foreach ($mariamaOrders as $ref) {
            // Les références se suivent (CMD-2026-000102…) : la vérification du propriétaire est indispensable
            $this->getJson("/api/v1/me/orders/{$ref}")->assertForbidden();
            $this->get("/api/v1/me/orders/{$ref}/invoice", ['Accept' => 'application/json'])->assertForbidden();
        }
        $this->postJson('/api/v1/me/bookings/RDV-2026-000201/cancel')->assertForbidden();
    }

    public function test_3b_impossible_de_modifier_le_compte_d_un_autre_ni_de_se_donner_un_role(): void
    {
        $mariama = User::where('email', 'mariama@client.test')->first();
        $admin = User::where('email', 'admin@dabohair.test')->first();
        $this->actingAs($mariama)->patchJson('/api/v1/me/profile', [
            'first_name' => 'Mariama', 'last_name' => 'Sow', 'phone' => '770000003',
            'id' => $admin->id, 'user_id' => $admin->id, 'email' => 'pirate@exemple.sn', 'role' => 'super_admin', 'is_active' => false,
        ])->assertOk();

        $this->assertSame('admin@dabohair.test', $admin->fresh()->email);
        $this->assertTrue($admin->fresh()->is_active);
        $this->assertSame('mariama@client.test', $mariama->fresh()->email);
        $this->assertFalse($mariama->fresh()->hasRole('super_admin'));
    }

    // ---------- 4. L'administration est derrière une connexion ----------

    public function test_4_chaque_route_de_l_erp_refuse_les_visiteurs_et_les_clientes(): void
    {
        $routes = collect(Route::getRoutes()->getRoutes())->filter(fn (RouteDefinition $r) => str_starts_with($r->uri(), 'api/v1/admin'));
        $call = function (RouteDefinition $r) {
            $uri = '/'.preg_replace('/\{[^}]+\}/', '1', $r->uri());
            $method = collect($r->methods())->first(fn ($m) => $m !== 'HEAD');

            return $this->json($method, $uri, []);
        };

        foreach ($routes as $route) {
            $call($route)->assertUnauthorized(); // visiteur : 401
        }
        $this->actingAs(User::where('email', 'mariama@client.test')->first());
        foreach ($routes as $route) {
            $status = $call($route)->status();
            // cliente connectée : jamais de données (403, ou 404 quand l'objet fictif « 1 » n'existe pas)
            $this->assertContains($status, [403, 404], "{$route->uri()} a répondu {$status} à une cliente");
        }
    }

    // ---------- 5. Limites à l'inscription et à la connexion ----------

    public function test_5a_au_dela_de_20_inscriptions_par_heure_la_meme_adresse_est_bloquee(): void
    {
        for ($i = 1; $i <= 20; $i++) {
            $this->postJson('/api/v1/auth/register', [])->assertUnprocessable(); // même invalide, l'essai compte
        }
        $this->postJson('/api/v1/auth/register', [])->assertStatus(429);
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.9'])->postJson('/api/v1/auth/register', [])->assertUnprocessable();
    }

    public function test_5b_connexion_bloquee_apres_5_echecs_et_api_limitee_a_120_requetes_par_minute(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['email' => 'mariama@client.test', 'password' => 'mauvais-'.$i]);
        }
        $this->postJson('/api/v1/auth/login', ['email' => 'mariama@client.test', 'password' => 'demo-dabo-2026'])->assertStatus(429);
        $this->assertSame(120, config('app.rate_limits.api'));
    }

    // ---------- 6. Webhooks ----------

    /**
     * Aucun webhook n'existe aujourd'hui (paiements enregistrés à la main, SMS en mode journal).
     * Garde-fou : toute route d'ÉCRITURE accessible sans connexion doit figurer dans cette liste revue.
     * Le jour où un webhook arrive (Wave, Orange Money, fournisseur de SMS), ce test échoue tant qu'on ne l'a pas
     * ajouté ici AVEC la vérification de sa signature (HMAC) et un test dédié.
     */
    public function test_6_aucune_route_d_ecriture_publique_non_revue_et_donc_aucun_webhook_non_verifie(): void
    {
        $reviewed = [
            'POST api/v1/bookings' => 'réservation : validation + limite de 20/heure',
            'POST api/v1/orders' => 'commande : validation + limite de 20/heure, prix recalculés',
            'POST api/v1/auth/login' => 'connexion : 5 essais',
            'POST api/v1/auth/register' => 'inscription : limite de 20/heure',
            'POST api/v1/surveys/{token}' => 'enquête : lien personnel de 40 caractères (empreinte SHA-256)',
            'POST api/v1/handover/{token}' => 'remise : lien personnel + code de la cliente, 5 essais',
        ];
        $public = collect(Route::getRoutes()->getRoutes())
            ->filter(fn (RouteDefinition $r) => str_starts_with($r->uri(), 'api/'))
            ->filter(fn (RouteDefinition $r) => array_intersect($r->methods(), ['POST', 'PUT', 'PATCH', 'DELETE']) !== [])
            ->reject(fn (RouteDefinition $r) => in_array('auth:sanctum', $r->gatherMiddleware(), true))
            ->map(fn (RouteDefinition $r) => collect($r->methods())->first(fn ($m) => $m !== 'HEAD').' '.$r->uri())
            ->values()->all();

        $this->assertSame([], array_values(array_diff($public, array_keys($reviewed))), 'Route d’écriture publique non revue (webhook ?)');
        $this->assertEmpty(array_filter($public, fn ($r) => str_contains(strtolower($r), 'webhook')));
    }
}
