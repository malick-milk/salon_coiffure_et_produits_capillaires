<?php

namespace Tests\Feature;

use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Migration du 27 novembre 2026 : les numéros « +221… » déjà enregistrés passent au format court, sans écraser un doublon */
class PhoneNormalizationMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_les_anciens_numeros_passent_au_format_court_et_les_vrais_doublons_restent_signales(): void
    {
        $solo = Customer::create(['first_name' => 'Awa', 'last_name' => 'Sy', 'phone' => '+221781112233']);
        $short = Customer::create(['first_name' => 'Bineta', 'last_name' => 'Fall', 'phone' => '769998877']);
        $twin = Customer::create(['first_name' => 'Bineta', 'last_name' => 'Fall', 'phone' => '+221769998877']);
        $foreign = Customer::create(['first_name' => 'Léa', 'last_name' => 'Martin', 'phone' => '+33612345678']);

        (require database_path('migrations/2026_11_27_100000_normalize_phone_numbers.php'))->up();

        $this->assertSame('781112233', $solo->fresh()->phone);
        $this->assertSame('769998877', $short->fresh()->phone);
        $this->assertSame('+221769998877', $twin->fresh()->phone); // vrai doublon : fusion à la main, rien n'est écrasé
        $this->assertSame('+33612345678', $foreign->fresh()->phone);
    }
}
