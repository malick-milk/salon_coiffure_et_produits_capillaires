<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** Commandes « php artisan » écrites pour le projet */
class ConsoleCommandsTest extends TestCase
{
    use RefreshDatabase;

    public function test_creer_le_compte_du_proprietaire(): void
    {
        $this->artisan('app:create-admin')
            ->expectsQuestion('Prénom', 'Aïssatou')->expectsQuestion('Nom', 'Dabo')->expectsQuestion('Email', 'Patronne@DaboHair.sn')
            ->expectsQuestion('Mot de passe (12 caractères minimum, lettres et chiffres)', 'Salon2026Dakar')
            ->expectsOutputToContain('Administrateur patronne@dabohair.sn créé.')
            ->assertSuccessful();

        $user = User::where('email', 'patronne@dabohair.sn')->first(); // email mis en minuscules
        $this->assertTrue($user->hasRole('super_admin'));
        $this->assertTrue(Hash::check('Salon2026Dakar', $user->password)); // haché, jamais en clair
        $this->assertNotSame('Salon2026Dakar', $user->password);
    }

    public function test_mot_de_passe_faible_ou_email_deja_pris_refuses(): void
    {
        $this->artisan('app:create-admin')
            ->expectsQuestion('Prénom', 'Awa')->expectsQuestion('Nom', 'Ndiaye')->expectsQuestion('Email', 'admin@dabohair.test')
            ->expectsQuestion('Mot de passe (12 caractères minimum, lettres et chiffres)', 'court')
            ->assertFailed();
        $this->assertSame(1, User::where('email', 'admin@dabohair.test')->count());
    }

    public function test_calcul_des_agregats_en_ligne_de_commande(): void
    {
        $this->artisan('analytics:snapshot', ['--from' => '2026-03-20', '--to' => '2026-03-24'])
            ->expectsOutputToContain('5 jour(s) calculé(s), du 2026-03-20 au 2026-03-24.')->assertSuccessful();
        $this->assertSame(5, DB::table('daily_sales_snapshots')->count());
        $this->assertSame(5 * 10, DB::table('daily_product_stats')->count()); // 10 produits × 5 jours

        $this->artisan('analytics:snapshot', ['--from' => '2026-03-24', '--to' => '2026-03-20'])->assertFailed();
        $this->artisan('analytics:snapshot', ['--all' => true])->expectsOutputToContain('2026-03-20')->assertSuccessful(); // depuis le 1er mouvement
    }

    public function test_identite_legale_de_l_entreprise_pour_les_factures(): void
    {
        $this->artisan('app:company')->expectsOutputToContain('[À RENSEIGNER]')->assertSuccessful();
        $this->artisan('app:company', ['--ninea' => '00123456 2G3', '--rccm' => 'SN-DKR-2026-A-12345'])
            ->expectsOutputToContain('SN-DKR-2026-A-12345')->assertSuccessful();

        $identity = Setting::where('key', 'company.identity')->first()->value;
        $this->assertSame('00123456 2G3', $identity['ninea']);
        $this->assertSame('Dabo Hair', $identity['name']); // les autres champs sont conservés
    }
}
