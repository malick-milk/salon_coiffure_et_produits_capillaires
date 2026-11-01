<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** API publique du catalogue : contrat (types/api.ts), filtres, et données qui ne doivent JAMAIS sortir */
class CatalogApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_les_categories_comptent_aussi_les_produits_des_sous_categories(): void
    {
        $this->getJson('/api/v1/categories')->assertOk()
            ->assertJsonPath('data.0.slug', 'soins-capillaires')
            ->assertJsonPath('data.0.product_count', 9)
            ->assertJsonPath('data.1.slug', 'serums')
            ->assertJsonPath('data.1.product_count', 3);
    }

    public function test_la_liste_respecte_le_format_pagine_du_contrat(): void
    {
        $this->getJson('/api/v1/products')->assertOk()
            ->assertJsonCount(9, 'data')
            ->assertJsonPath('meta', ['current_page' => 1, 'last_page' => 1, 'per_page' => 12, 'total' => 9])
            ->assertJsonStructure(['data' => [['id', 'slug', 'sku', 'name', 'brand', 'unit_size', 'price', 'stock_status', 'stock_left', 'category', 'image_url']]]);
    }

    public function test_le_prix_de_revient_et_le_stock_exact_ne_sont_jamais_exposes(): void
    {
        $json = $this->getJson('/api/v1/products/serum-booster-30-ml')->assertOk()->getContent();

        $this->assertStringNotContainsString('cost_price', $json);
        $this->assertStringNotContainsString('266.67', $json); // coût unitaire réel du sérum Booster
        $this->assertStringNotContainsString('stock_quantity', $json);
    }

    public function test_filtre_par_categorie_parente_inclut_les_sous_categories_et_tri_par_prix(): void
    {
        $this->getJson('/api/v1/products?category=serums&sort=price_asc')->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.unit_size', '15 ml')
            ->assertJsonPath('data.0.price', 1500);

        $this->getJson('/api/v1/products?category=soins-capillaires')->assertJsonPath('meta.total', 9);
    }

    public function test_la_recherche_ignore_les_accents_et_les_majuscules(): void
    {
        $this->getJson('/api/v1/products?search=CREME')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Crème capillaire');
    }

    public function test_la_recherche_neutralise_les_jokers_sql(): void
    {
        // « % » seul ne doit PAS tout renvoyer : il est traité comme un caractère normal
        $this->getJson('/api/v1/products?search=%25')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_statuts_de_stock_rupture_et_stock_faible(): void
    {
        // Crème : 96 fabriquées, 96 vendues au revendeur
        $this->getJson('/api/v1/products/creme-capillaire')->assertJsonPath('data.stock_status', 'out_of_stock');
        $this->getJson('/api/v1/products?in_stock=1')->assertJsonPath('meta.total', 8);

        // Masque : 24 en stock, seuil d'alerte relevé à 30 -> stock faible, avec le nombre restant
        Product::where('sku', 'DAB-MAS-001')->update(['low_stock_threshold' => 30]);
        $this->getJson('/api/v1/products/masque-capillaire')
            ->assertJsonPath('data.stock_status', 'low_stock')
            ->assertJsonPath('data.stock_left', 24);
    }

    public function test_la_fiche_propose_les_autres_contenances(): void
    {
        $this->getJson('/api/v1/products/serum-activ-pousse-15-ml')->assertOk()
            ->assertJsonCount(2, 'data.variants')
            ->assertJsonPath('data.variants.0.unit_size', '30 ml')
            ->assertJsonPath('data.variants.1.is_current', true);
    }

    public function test_un_produit_inactif_ou_inconnu_renvoie_une_404_en_francais(): void
    {
        Product::where('sku', 'DAB-SAC-001')->update(['is_active' => false]);

        $this->getJson('/api/v1/products/spray-anti-chute')->assertNotFound()->assertExactJson(['message' => 'Ressource introuvable.']);
        $this->getJson('/api/v1/products/inexistant')->assertNotFound();
        $this->getJson('/api/v1/products')->assertJsonPath('meta.total', 8);
    }

    public function test_les_filtres_invalides_sont_refuses_avec_un_message_en_francais(): void
    {
        $this->getJson('/api/v1/products?min_price=abc&sort=hack')->assertUnprocessable()
            ->assertJsonPath('errors.min_price.0', 'Le prix minimum doit être un nombre entier.')
            ->assertJsonValidationErrors(['sort']);
    }

    public function test_salon_prestations_coiffeurs_horaires_et_zones(): void
    {
        $this->getJson('/api/v1/services')->assertOk()->assertJsonCount(3, 'data')->assertJsonMissingPath('data.0.buffer_minutes');
        // Bineta ne réalise pas les nattes collées
        $nattes = \App\Models\Service::where('slug', 'nattes-collees')->value('id');
        $this->getJson("/api/v1/stylists?service_id={$nattes}")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.display_name', 'Fatou');
        $this->getJson('/api/v1/business-hours')->assertJsonPath('data.0.opens_at', '09:00')->assertJsonPath('data.6.is_closed', true);
        $this->getJson('/api/v1/delivery-zones')->assertJsonPath('data.0', ['id' => 1, 'name' => 'Dakar Plateau', 'fee' => 1000]);
    }
}
