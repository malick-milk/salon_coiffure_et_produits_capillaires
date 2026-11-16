<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\PurchaseReceipt;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Ajouter un produit depuis l'ERP : fiche, photos, publication, réceptions d'achat (16 novembre 2026) */
class ProductCreationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function admin(string $role = 'super_admin'): User
    {
        $user = tap(User::factory()->create())->assignRole($role);
        $this->actingAs($user);

        return $user;
    }

    private function vhfBrandId(): int
    {
        return Brand::firstOrCreate(['slug' => 'virgin-hair-fertilizer'], ['name' => 'Virgin Hair Fertilizer', 'is_house_brand' => false, 'is_active' => true])->id;
    }

    /** @return array<string, mixed> */
    private function payload(array $over = []): array
    {
        return [
            'origin' => 'resold', 'name' => 'Huile de croissance', 'brand_id' => $this->vhfBrandId(),
            'category_id' => Category::where('slug', 'soins-traitants')->value('id'), 'unit_size' => '120 ml', 'price' => 6000,
            'short_description' => 'Fait pousser et fortifie les cheveux.', ...$over,
        ];
    }

    private function photo(int $w = 1600, int $h = 1200): UploadedFile
    {
        return UploadedFile::fake()->image('photo.jpg', $w, $h);
    }

    public function test_un_produit_revendu_nait_en_brouillon_avec_reference_et_adresse_automatiques(): void
    {
        $this->admin();
        $row = $this->postJson('/api/v1/admin/products', $this->payload())->assertCreated()->json('data');

        $this->assertSame('VHF-HUI-001', $row['sku']);           // marque Virgin Hair Fertilizer, « HUIle »
        $this->assertSame('huile-de-croissance-120-ml', $row['slug']);
        $this->assertSame('resold', $row['origin']);
        $this->assertFalse($row['is_active']);                   // brouillon
        $this->assertSame(0, $row['stock_quantity']);
        $this->assertNull($row['cost_price']);
        // Invisible sur le site tant qu'il n'est pas publié
        $this->getJson('/api/v1/products/huile-de-croissance-120-ml')->assertNotFound();
    }

    public function test_un_produit_dabo_hair_prend_le_prefixe_dab_et_une_reference_libre(): void
    {
        $this->admin();
        $dabo = Brand::where('is_house_brand', true)->value('id');
        $sku = $this->postJson('/api/v1/admin/products', ['origin' => 'made', 'name' => 'Crème capillaire', 'brand_id' => $dabo,
            'category_id' => Category::where('slug', 'hydratants-et-cremes')->value('id'), 'unit_size' => '500 ml', 'price' => 6000])
            ->assertCreated()->json('data.sku');
        $this->assertSame('DAB-CRE-001', Product::where('sku', 'DAB-CRE-001')->value('sku')); // existant : non touché
        $this->assertSame('DAB-CRE-002', $sku);                                                 // le suivant libre
    }

    public function test_doublon_champs_obligatoires_et_marque_existante_sont_refuses_en_francais(): void
    {
        $this->admin();
        $payload = $this->payload();
        $this->postJson('/api/v1/admin/products', $payload)->assertCreated();
        $this->postJson('/api/v1/admin/products', $payload)->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'Ce produit existe déjà dans cette marque et cette contenance.');
        $this->postJson('/api/v1/admin/products', [])->assertUnprocessable()->assertJsonValidationErrors(['origin', 'name', 'brand_id', 'category_id', 'price']);
        $this->postJson('/api/v1/admin/brands', ['name' => 'virgin hair fertilizer'])->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'Cette marque existe déjà.');
    }

    public function test_listes_du_formulaire_marques_et_categories_finales(): void
    {
        $this->admin();
        $this->assertSame('Dabo Hair', $this->getJson('/api/v1/admin/brands')->assertOk()->json('data.0.name')); // maison en premier
        $names = array_column($this->getJson('/api/v1/admin/categories')->assertOk()->json('data'), 'name');
        $this->assertContains('Soins traitants', $names);
        $this->assertNotContains('Soins capillaires', $names); // catégorie parente : on ne range pas un produit dedans

        $this->postJson('/api/v1/admin/brands', ['name' => 'Shea Moisture'])->assertCreated()->assertJsonPath('data.is_house_brand', false);
        $this->assertDatabaseHas('brands', ['slug' => 'shea-moisture']);
    }

    public function test_photo_recadree_en_carre_webp_premiere_principale_et_publication(): void
    {
        $this->admin();
        $id = $this->postJson('/api/v1/admin/products', $this->payload())->json('data.id');

        // Publier sans photo : refusé
        $this->patchJson("/api/v1/admin/products/{$id}", ['is_active' => true])->assertUnprocessable()
            ->assertJsonPath('errors.is_active.0', 'Ajoutez au moins une photo avant de publier ce produit.');

        $images = $this->post("/api/v1/admin/products/{$id}/images", ['image' => $this->photo()], ['Accept' => 'application/json'])->assertCreated()->json('data.images');
        $this->assertCount(1, $images);
        $this->assertTrue($images[0]['is_primary']);
        $this->assertStringStartsWith('/storage/produits/huile-de-croissance-120-ml-', $images[0]['url']);
        $file = Storage::disk('public')->get(str_replace('/storage/', '', $images[0]['url']));
        [$w, $h, $type] = getimagesizefromstring((string) $file);
        $this->assertSame([1200, 1200, IMAGETYPE_WEBP], [$w, $h, $type]); // carré, réduit, ré-encodé en WebP

        $this->patchJson("/api/v1/admin/products/{$id}", ['is_active' => true])->assertOk()->assertJsonPath('data.is_active', true);
        $this->getJson('/api/v1/products/huile-de-croissance-120-ml')->assertOk()
            ->assertJsonPath('data.images.0.url', $images[0]['url']);
    }

    public function test_quatre_photos_au_plus_principale_modifiable_et_derniere_photo_protegee(): void
    {
        $this->admin();
        $id = $this->postJson('/api/v1/admin/products', $this->payload())->json('data.id');
        foreach (range(1, 4) as $i) {
            $this->post("/api/v1/admin/products/{$id}/images", ['image' => $this->photo()], ['Accept' => 'application/json'])->assertCreated();
        }
        $this->post("/api/v1/admin/products/{$id}/images", ['image' => $this->photo()], ['Accept' => 'application/json'])->assertUnprocessable();

        $images = Product::find($id)->images;
        $second = $images[1];
        $this->patchJson("/api/v1/admin/products/{$id}/images/{$second->id}/primary")->assertOk()
            ->assertJsonPath('data.images.0.id', $second->id)->assertJsonPath('data.images.0.is_primary', true);

        // Supprimer la principale : la suivante prend le relais, le fichier disparaît du disque
        $this->deleteJson("/api/v1/admin/products/{$id}/images/{$second->id}")->assertOk()->assertJsonPath('data.images.0.is_primary', true);
        Storage::disk('public')->assertMissing(str_replace('/storage/', '', $second->path));

        // En vente : impossible de retirer la dernière photo
        Product::find($id)->images()->where('is_primary', false)->get()->each->delete();
        $this->patchJson("/api/v1/admin/products/{$id}", ['is_active' => true])->assertOk();
        $last = Product::find($id)->images()->first();
        $this->deleteJson("/api/v1/admin/products/{$id}/images/{$last->id}")->assertUnprocessable();

        // Une photo d'un AUTRE produit ne peut pas être visée par cette adresse
        $other = Product::where('sku', 'DAB-MAS-001')->first()->images()->first();
        $this->deleteJson("/api/v1/admin/products/{$id}/images/{$other->id}")->assertNotFound();
    }

    public function test_photo_trop_petite_ou_fichier_qui_n_est_pas_une_image_refuses(): void
    {
        $this->admin();
        $id = $this->postJson('/api/v1/admin/products', $this->payload())->json('data.id');
        $this->post("/api/v1/admin/products/{$id}/images", ['image' => $this->photo(300, 300)], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonPath('errors.image.0', 'La photo est trop petite : 400 × 400 pixels au minimum.');
        $this->post("/api/v1/admin/products/{$id}/images", ['image' => UploadedFile::fake()->create('script.php', 10, 'text/x-php')], ['Accept' => 'application/json'])
            ->assertUnprocessable();
    }

    public function test_reception_d_achat_stock_grand_livre_et_cout_moyen_pondere(): void
    {
        $admin = $this->admin();
        $id = $this->postJson('/api/v1/admin/products', $this->payload())->json('data.id');

        // 1re réception : 10 × 2 000 F, pas de frais -> coût 2 000 F
        $this->postJson('/api/v1/admin/purchase-receipts', ['product_id' => $id, 'supplier_name' => 'Grossiste Sandaga', 'received_on' => now()->toDateString(),
            'quantity' => 10, 'unit_price' => 2000])->assertCreated()->assertJsonPath('data.unit_cost', 2000);
        // 2e réception : 20 × 2 500 F + 2 000 F de transport = 2 600 F l'unité
        $this->postJson('/api/v1/admin/purchase-receipts', ['product_id' => $id, 'supplier_name' => 'Grossiste Sandaga', 'supplier_invoice' => 'F-118',
            'received_on' => now()->toDateString(), 'quantity' => 20, 'unit_price' => 2500, 'extra_costs' => 2000])
            ->assertCreated()->assertJsonPath('data.unit_cost', 2600)->assertJsonPath('data.total', 52000);

        $product = Product::find($id);
        $this->assertSame(30, $product->stock_quantity);
        $this->assertEquals(2400.00, (float) $product->cost_price); // (10 × 2 000 + 20 × 2 600) ÷ 30
        $movement = StockMovement::where('product_id', $id)->latest('id')->first();
        $this->assertSame(['purchase', 20, 30, 2600, PurchaseReceipt::class, $admin->id],
            [$movement->type->value, $movement->quantity, $movement->stock_after, $movement->unit_cost, $movement->reference_type, $movement->user_id]);

        $list = $this->getJson('/api/v1/admin/purchase-receipts')->assertOk()->json('data');
        $this->assertSame(['F-118', 'Huile de croissance 120 ml', 'Virgin Hair Fertilizer'], [$list[0]['supplier_invoice'], $list[0]['product_name'], $list[0]['brand']]);
        $this->assertDatabaseHas('activity_log', ['log_name' => 'purchases', 'subject_type' => PurchaseReceipt::class]);
    }

    public function test_fabrique_et_revendu_ne_se_melangent_pas_et_date_future_refusee(): void
    {
        $this->admin();
        $resold = $this->postJson('/api/v1/admin/products', $this->payload())->json('data.id');
        $made = Product::where('sku', 'DAB-SHA-001')->value('id');

        $this->postJson('/api/v1/admin/purchase-receipts', ['product_id' => $made, 'supplier_name' => 'Grossiste', 'received_on' => now()->toDateString(), 'quantity' => 5, 'unit_price' => 100])
            ->assertUnprocessable()->assertJsonPath('errors.product_id.0', 'Ce produit est fabriqué par Dabo Hair : son stock entre par la Fabrication.');
        $this->postJson('/api/v1/admin/production-batches', ['product_id' => $resold, 'batch_number' => 'LOT-X', 'quantity_produced' => 5, 'produced_on' => now()->toDateString()])
            ->assertUnprocessable()->assertJsonPath('errors.product_id.0', "Ce produit est acheté et revendu : son stock entre par une réception d'achat.");
        $this->postJson('/api/v1/admin/purchase-receipts', ['product_id' => $resold, 'supplier_name' => 'Grossiste', 'received_on' => now()->addDay()->toDateString(), 'quantity' => 5, 'unit_price' => 100])
            ->assertUnprocessable()->assertJsonValidationErrors(['received_on']);
        $this->assertSame(0, Product::find($resold)->stock_quantity);
    }

    public function test_droits_le_caissier_ne_cree_rien_le_magasinier_receptionne(): void
    {
        $this->admin();
        $id = $this->postJson('/api/v1/admin/products', $this->payload())->json('data.id');

        $this->admin('cashier');
        $this->postJson('/api/v1/admin/products', $this->payload())->assertForbidden();
        $this->post("/api/v1/admin/products/{$id}/images", ['image' => $this->photo()], ['Accept' => 'application/json'])->assertForbidden();
        $this->postJson('/api/v1/admin/purchase-receipts', ['product_id' => $id, 'supplier_name' => 'X', 'received_on' => now()->toDateString(), 'quantity' => 1, 'unit_price' => 1])->assertForbidden();

        $this->admin('stock_keeper');
        $this->postJson('/api/v1/admin/purchase-receipts', ['product_id' => $id, 'supplier_name' => 'Grossiste', 'received_on' => now()->toDateString(), 'quantity' => 6, 'unit_price' => 1500])->assertCreated();
        $this->postJson('/api/v1/admin/products', $this->payload(['name' => 'Autre']))->assertForbidden();
    }
}
