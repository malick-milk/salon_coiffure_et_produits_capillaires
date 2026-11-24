<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Menu « Gammes » de l'en-tête (maquette validée le 24 novembre 2026) : la liste des gammes dit ce qu'elles contiennent */
class GammesMenuTest extends TestCase
{
    use RefreshDatabase;

    public function test_la_liste_des_gammes_donne_leur_contenu_sans_requete_par_gamme(): void
    {
        $queries = 0;
        \DB::listen(function () use (&$queries) {
            $queries++;
        });
        $res = $this->getJson('/api/v1/products?category=gammes')->assertOk();
        $gamme = collect($res->json('data'))->firstWhere('sku', 'DAB-GAM-001');
        $this->assertNotNull($gamme);
        $this->assertTrue($gamme['is_bundle']);
        $this->assertCount(6, $gamme['bundle_contents']);
        $this->assertContains('Shampooing sans sulfate', $gamme['bundle_contents']);
        $this->assertNotEmpty($gamme['short_description']);
        $this->assertLessThan(40, $queries, 'la composition est chargée en une fois, pas une requête par gamme');
    }

    public function test_un_produit_simple_n_a_pas_de_contenu(): void
    {
        $spray = collect($this->getJson('/api/v1/products?category=hydratants-et-cremes')->assertOk()->json('data'))->firstWhere('sku', 'DAB-SPH-250');
        $this->assertNotNull($spray, 'le spray hydratant est bien dans la liste');
        $this->assertFalse($spray['is_bundle']);
        $this->assertNull($spray['bundle_contents']);
    }
}
