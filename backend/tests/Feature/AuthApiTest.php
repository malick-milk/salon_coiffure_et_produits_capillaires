<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Authentification Sanctum SPA (ADR-003, RG-SEC-02) */
class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_connexion_puis_me_puis_deconnexion(): void
    {
        $this->postJson('/api/v1/auth/login', ['email' => 'Mariama@Client.test ', 'password' => 'demo-dabo-2026', 'remember' => true])
            ->assertOk()->assertJsonPath('data.first_name', 'Mariama')->assertJsonPath('data.roles', ['customer'])->assertJsonMissingPath('data.password');
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.email', 'mariama@client.test');
        $this->assertNotNull(User::where('email', 'mariama@client.test')->value('last_login_at'));

        $this->postJson('/api/v1/auth/logout')->assertNoContent();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_un_visiteur_recoit_401_sur_les_routes_protegees(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->getJson('/api/v1/me/orders')->assertUnauthorized();
    }

    public function test_mauvais_mot_de_passe_message_vague_et_blocage_apres_5_echecs(): void
    {
        $message = 'Ces identifiants ne correspondent à aucun compte.';
        // Même message pour un email inconnu et un mauvais mot de passe : impossible de deviner les comptes existants
        $this->postJson('/api/v1/auth/login', ['email' => 'inconnu@client.test', 'password' => 'x'])->assertJsonPath('errors.email.0', $message);
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['email' => 'mariama@client.test', 'password' => "faux-{$i}"])->assertUnprocessable()->assertJsonPath('errors.email.0', $message);
        }
        // 6e essai, même avec le BON mot de passe : bloqué
        $this->postJson('/api/v1/auth/login', ['email' => 'mariama@client.test', 'password' => 'demo-dabo-2026'])
            ->assertStatus(429)->assertJsonPath('message', 'Trop de tentatives. Réessayez dans une minute.');
    }

    public function test_un_compte_desactive_ne_peut_pas_se_connecter(): void
    {
        User::where('email', 'mariama@client.test')->update(['is_active' => false]);
        $this->postJson('/api/v1/auth/login', ['email' => 'mariama@client.test', 'password' => 'demo-dabo-2026'])->assertUnprocessable();
    }

    public function test_inscription_mot_de_passe_hache_role_client_et_connexion_automatique(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'first_name' => 'Ndeye', 'last_name' => 'Gueye', 'email' => 'Ndeye@Client.test', 'phone' => '70 222 33 44',
            'password' => 'nouveau-mdp-1', 'password_confirmation' => 'nouveau-mdp-1', 'consent' => true,
        ])->assertCreated()->assertJsonPath('data.email', 'ndeye@client.test')->assertJsonPath('data.phone', '702223344');

        $user = User::where('email', 'ndeye@client.test')->first();
        $this->assertNotSame('nouveau-mdp-1', $user->password); // jamais en clair
        $this->assertTrue(password_verify('nouveau-mdp-1', $user->password));
        $this->assertTrue($user->hasRole('customer'));
        $this->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_inscription_refusee_email_pris_confirmation_differente(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'first_name' => 'A', 'last_name' => 'B', 'email' => 'mariama@client.test', 'phone' => '770000003',
            'password' => 'court', 'password_confirmation' => 'autre', 'consent' => false,
        ])->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'Un compte existe déjà avec cette adresse.')
            ->assertJsonPath('errors.phone.0', 'Ce numéro est déjà utilisé.')
            ->assertJsonValidationErrors(['first_name', 'password', 'consent']);
    }

    public function test_un_invite_qui_cree_son_compte_retrouve_son_historique(): void
    {
        $guest = Customer::create(['first_name' => 'Coumba', 'last_name' => 'Mbaye', 'phone' => '781234567']);
        $this->postJson('/api/v1/auth/register', [
            'first_name' => 'Coumba', 'last_name' => 'Mbaye', 'email' => 'coumba@client.test', 'phone' => '78 123 45 67',
            'password' => 'mot-de-passe-1', 'password_confirmation' => 'mot-de-passe-1', 'consent' => true,
        ])->assertCreated();

        $this->assertSame(User::where('email', 'coumba@client.test')->value('id'), $guest->fresh()->user_id); // RG-RES-08
    }
}
