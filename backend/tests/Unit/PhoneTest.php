<?php

namespace Tests\Unit;

use App\Support\Phone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Validation et normalisation des numéros mobiles sénégalais (test unitaire, sans base) */
class PhoneTest extends TestCase
{
    /** DataProvider : le même test est rejoué avec chaque jeu de données */
    public static function numeros(): array
    {
        return [
            'Orange 77' => ['77 123 45 67', true],
            'Free 76 avec points' => ['76.123.45.67', true],
            'Expresso 70' => ['70 123 45 67', true],
            'avec indicatif +221' => ['+221 78 123 45 67', true],
            'fixe 33 refusé' => ['33 823 45 67', false],
            'trop court' => ['77 123 45', false],
            'lettres' => ['77 ABC 45 67', false],
        ];
    }

    #[DataProvider('numeros')]
    public function test_validation_des_mobiles(string $saisi, bool $valide): void
    {
        $this->assertSame($valide, (bool) preg_match(Phone::SENEGAL_MOBILE, Phone::normalize($saisi)));
    }

    public function test_la_normalisation_retire_espaces_points_et_tirets(): void
    {
        $this->assertSame('771234567', Phone::normalize('77-123.45 67'));
        $this->assertSame('', Phone::normalize(null));
    }

    /** Bug du 27 novembre 2026 : « +221 77… » et « 77… » créaient deux fiches clientes */
    public function test_l_indicatif_du_senegal_est_retire_un_seul_format_en_base(): void
    {
        foreach (['+221 77 123 45 67', '00221771234567', '221771234567', '(+221) 77.123.45.67', '771234567'] as $saisi) {
            $this->assertSame('771234567', Phone::normalize($saisi), $saisi);
        }
        $this->assertSame('+33612345678', Phone::normalize('+33 6 12 34 56 78')); // étranger : gardé tel quel
        $this->assertSame('+221338234567', Phone::normalize('+221 33 823 45 67')); // fixe : pas un mobile, gardé
    }

    /** Étape 13 : format international exigé par les fournisseurs de SMS */
    public function test_format_international_pour_les_sms(): void
    {
        $this->assertSame('+221771234567', Phone::toE164('77 123 45 67'));
        $this->assertSame('+221701234567', Phone::toE164('+221 70.123.45.67'));
        $this->assertSame('+221781234567', Phone::toE164('00221781234567'));
        $this->assertNull(Phone::toE164('33 823 45 67'));  // fixe : pas de SMS
        $this->assertNull(Phone::toE164('06 12 34 56 78')); // étranger
        $this->assertNull(Phone::toE164(null));
        $this->assertSame('+22177***4567', Phone::mask('+221771234567'));
        $this->assertNull(Phone::mask(null));
    }
}
