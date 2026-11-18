<?php

namespace Tests\Feature;

use App\Enums\StockMovementType;
use App\Models\OrderItem;
use App\Models\PickupPoint;
use App\Models\Product;
use App\Models\User;
use App\Services\Inventory\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Lancement du 15 décembre 2026 : la GAMME COMPLÈTE (6 soins, 15 000 F) et son PRIX MEMBRE
 * (10 000 F pour une cliente connectée, 20 gammes, une par compte). Maquettes validées le 18 novembre 2026.
 */
class MemberPriceTest extends TestCase
{
    use RefreshDatabase;

    private const GAMME = 'gamme-complete-dabo-hair';

    private function id(string $sku): int
    {
        return Product::where('sku', $sku)->value('id');
    }

    private function stock(string $sku): int
    {
        return Product::where('sku', $sku)->value('stock_quantity');
    }

    /** Dans la base de démonstration, la crème est en rupture (vendue au revendeur) : on en fabrique */
    private function cremeEnStock(int $quantity = 30): void
    {
        app(StockService::class)->record(Product::where('sku', 'DAB-CRE-001')->first(), StockMovementType::Production, $quantity, reason: 'Lot de test');
    }

    private function order(array $items, string $phone = '76 111 22 33', array $over = []): TestResponse
    {
        return $this->postJson('/api/v1/orders', [
            'items' => $items, 'fulfillment_method' => 'pickup', 'delivery_zone_id' => null, 'shipping_address' => null, 'notes' => null, 'consent' => true,
            'customer' => ['first_name' => 'Khady', 'last_name' => 'Fall', 'phone' => $phone, 'email' => null], ...$over,
        ]);
    }

    private function gamme(int $quantity = 1): array
    {
        return [['product_id' => $this->id('DAB-GAM-001'), 'quantity' => $quantity]];
    }

    private function member(string $phone): User
    {
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $user = tap(User::factory()->create(['phone' => $phone]))->assignRole('customer');
        $this->actingAs($user);

        return $user;
    }

    public function test_la_gamme_contient_six_soins_et_suit_leur_stock(): void
    {
        $fiche = $this->getJson('/api/v1/products/'.self::GAMME)->assertOk()->json('data');
        $this->assertSame([true, 15000, 10000, 6, 'out_of_stock'], [$fiche['is_bundle'], $fiche['price'], $fiche['member_price'], count($fiche['bundle_items']), $fiche['stock_status']]);
        $this->assertSame(['limit' => 20, 'remaining' => 20, 'status' => 'sign_in'], $fiche['member_offer']); // visiteuse sans compte

        $this->cremeEnStock();
        $this->getJson('/api/v1/products/'.self::GAMME)->assertJsonPath('data.stock_status', 'in_stock');
        $this->getJson('/api/v1/products?in_stock=1')->assertJsonPath('meta.total', 11); // la gamme compte maintenant
    }

    public function test_sans_compte_la_gamme_coute_15000_et_ses_soins_sortent_du_stock(): void
    {
        $this->cremeEnStock();
        $avant = $this->stock('DAB-LEA-250');

        $this->order($this->gamme())->assertCreated()->assertJsonPath('data.subtotal', 15000);

        $item = OrderItem::latest('id')->first();
        $this->assertSame([15000, null], [$item->unit_price, $item->regular_unit_price]);
        $this->assertSame($avant - 1, $this->stock('DAB-LEA-250'));
        $this->assertSame(29, $this->stock('DAB-CRE-001'));
        $this->assertDatabaseHas('stock_movements', ['product_id' => $this->id('DAB-SHA-001'), 'type' => 'sale', 'quantity' => -1, 'reason' => 'Vente de Gamme complète Dabo Hair 6 soins']);
        $this->assertSame(0, Product::where('sku', 'DAB-GAM-001')->value('stock_quantity')); // la gamme n'a pas de stock à elle
    }

    public function test_une_cliente_connectee_paie_10000_une_seule_fois(): void
    {
        $this->cremeEnStock();
        $this->member('771112233');
        $this->getJson('/api/v1/products/'.self::GAMME)->assertJsonPath('data.member_offer.status', 'eligible');

        // 2 gammes : la 1re au prix membre, la 2e au prix normal
        $this->order($this->gamme(2), '771112233')->assertCreated()->assertJsonPath('data.subtotal', 25000);
        $this->assertSame([[10000, 15000, 1], [15000, null, 1]],
            OrderItem::orderBy('id')->get()->map(fn ($i) => [$i->unit_price, $i->regular_unit_price, $i->quantity])->take(-2)->values()->all());

        // Une par compte : la commande suivante est au prix normal, et la fiche le dit
        $this->getJson('/api/v1/products/'.self::GAMME)->assertJsonPath('data.member_offer.status', 'already_used')->assertJsonPath('data.member_offer.remaining', 19);
        $this->order($this->gamme(), '771112233')->assertCreated()->assertJsonPath('data.subtotal', 15000);
    }

    public function test_apres_la_derniere_place_le_prix_membre_s_arrete_et_une_annulation_la_rend(): void
    {
        $this->cremeEnStock();
        Product::where('sku', 'DAB-GAM-001')->update(['member_price_limit' => 1]);
        $this->member('771112233');
        $reference = $this->order($this->gamme(), '771112233')->assertCreated()->json('data.reference');

        $this->member('772223344');
        $this->getJson('/api/v1/products/'.self::GAMME)->assertJsonPath('data.member_offer', ['limit' => 1, 'remaining' => 0, 'status' => 'sold_out']);
        $this->order($this->gamme(), '772223344')->assertCreated()->assertJsonPath('data.subtotal', 15000);

        // Annulation de la 1re commande : la place revient, et les 6 soins retournent en stock
        $creme = $this->stock('DAB-CRE-001');
        $this->member('773334455')->assignRole('super_admin');
        $this->patchJson("/api/v1/admin/orders/{$reference}/status", ['status' => 'cancelled', 'reason' => 'Test'])->assertOk();
        $this->assertSame($creme + 1, $this->stock('DAB-CRE-001'));
        $this->getJson('/api/v1/products/'.self::GAMME)->assertJsonPath('data.member_offer.remaining', 1);
    }

    public function test_stock_insuffisant_et_point_de_retrait_refuses(): void
    {
        $this->cremeEnStock(1);
        // La crème seule est servie d'abord : il n'en reste plus pour la gamme
        $this->order([['product_id' => $this->id('DAB-CRE-001'), 'quantity' => 1], ...$this->gamme()])->assertStatus(409)
            ->assertJsonPath('items.0.product_id', $this->id('DAB-GAM-001'))->assertJsonPath('items.0.available', 0);
        $this->assertSame(1, $this->stock('DAB-CRE-001')); // rien n'a bougé

        $point = PickupPoint::create(['name' => 'Boutique de Moussa Diop', 'owner_name' => 'Moussa Diop', 'phone' => '771231234', 'regions' => ['Thiès'],
            'city' => 'Thiès', 'address' => 'Marché central', 'opening_hours' => 'Lundi au samedi'])->id;
        $this->order($this->gamme(), over: ['fulfillment_method' => 'pickup_point', 'pickup_point_id' => $point])->assertUnprocessable()
            ->assertJsonPath('message', 'La gamme se retire au salon ou se fait livrer : elle n’est pas disponible en point de retrait.');
    }

    public function test_erp_le_stock_d_une_gamme_ne_se_saisit_pas_et_le_prix_reste_au_dessus_du_prix_membre(): void
    {
        $this->member('773334455')->assignRole('super_admin');
        $id = $this->id('DAB-GAM-001');

        $row = $this->getJson('/api/v1/admin/products')->assertOk()->collect('data')->firstWhere('id', $id);
        $this->assertSame([true, 10000, 0], [$row['is_bundle'], $row['member_price'], $row['stock_quantity']]);
        $this->postJson("/api/v1/admin/products/{$id}/stock-adjustments", ['type' => 'adjustment', 'quantity' => 5, 'reason' => 'Inventaire'])->assertUnprocessable();
        $this->postJson('/api/v1/admin/production-batches', ['product_id' => $id, 'batch_number' => 'LOT-GAM', 'quantity_produced' => 5, 'produced_on' => now()->toDateString()])
            ->assertUnprocessable()->assertJsonValidationErrors(['product_id']);
        $this->patchJson("/api/v1/admin/products/{$id}", ['price' => 9000])->assertUnprocessable()
            ->assertJsonPath('errors.price.0', 'Le prix de vente doit rester supérieur au prix membre (10000 F).');
    }

    public function test_inscription_rapide_puis_connexion_par_telephone(): void
    {
        $this->postJson('/api/v1/auth/register', ['first_name' => 'Mariama', 'phone' => '77 123 45 67', 'password' => 'Lancement-2026', 'password_confirmation' => 'Lancement-2026', 'consent' => true])
            ->assertCreated()->assertJsonPath('data.email', null)->assertJsonPath('data.last_name', null);
        $this->assertDatabaseHas('customers', ['phone' => '771234567', 'first_name' => 'Mariama', 'last_name' => null, 'email' => null]);

        // Un 2e compte sans e-mail est permis (l'unicité ne porte que sur les e-mails remplis)
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/register', ['first_name' => 'Awa', 'phone' => '781234567', 'password' => 'Lancement-2026', 'password_confirmation' => 'Lancement-2026', 'consent' => true])->assertCreated();

        foreach (['77 123 45 67', '+221 77 123 45 67'] as $typed) {
            $this->flushSession();
            $this->app['auth']->forgetGuards();
            $this->postJson('/api/v1/auth/login', ['email' => $typed, 'password' => 'Lancement-2026'])->assertOk()->assertJsonPath('data.first_name', 'Mariama');
        }
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/login', ['email' => '771234567', 'password' => 'mauvais'])->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'Ces identifiants ne correspondent à aucun compte.');
        $this->postJson('/api/v1/auth/login', ['email' => 'mariama@client.test', 'password' => 'demo-dabo-2026'])->assertOk(); // l'e-mail marche toujours
    }

    public function test_la_premiere_commande_complete_le_nom_et_l_e_mail(): void
    {
        $this->postJson('/api/v1/auth/register', ['first_name' => 'Mariama', 'phone' => '771234567', 'password' => 'Lancement-2026', 'password_confirmation' => 'Lancement-2026', 'consent' => true])->assertCreated();
        $this->order([['product_id' => $this->id('DAB-SHA-001'), 'quantity' => 1]], '771234567', ['customer' => ['first_name' => 'Mariama', 'last_name' => 'Sow', 'phone' => '771234567', 'email' => 'mariama.sow@exemple.sn']])
            ->assertCreated();

        $this->assertDatabaseHas('customers', ['phone' => '771234567', 'last_name' => 'Sow', 'email' => 'mariama.sow@exemple.sn']);
    }

    public function test_un_numero_deja_sur_la_fiche_d_un_compte_est_refuse_proprement(): void
    {
        // Mariama a changé de numéro dans son profil : l'ancien (770000003) reste sur sa fiche cliente
        User::where('email', 'mariama@client.test')->update(['phone' => '785554433']);

        $this->postJson('/api/v1/auth/register', ['first_name' => 'Ndeye', 'phone' => '77 000 00 03', 'password' => 'Lancement-2026', 'password_confirmation' => 'Lancement-2026', 'consent' => true])
            ->assertUnprocessable()->assertJsonPath('errors.phone.0', 'Ce numéro est déjà utilisé.'); // et non une erreur 500
    }

    public function test_profil_le_numero_suit_la_fiche_et_un_compte_sans_e_mail_peut_en_ajouter_un(): void
    {
        $this->postJson('/api/v1/auth/register', ['first_name' => 'Astou', 'phone' => '764443322', 'password' => 'Lancement-2026', 'password_confirmation' => 'Lancement-2026', 'consent' => true])->assertCreated();

        // Nom facultatif, e-mail AJOUTÉ (le compte n'en avait pas), numéro changé : la fiche cliente suit
        $this->patchJson('/api/v1/me/profile', ['first_name' => 'Astou', 'last_name' => '', 'phone' => '76 444 33 11', 'email' => 'Astou@Exemple.sn'])
            ->assertOk()->assertJsonPath('data.email', 'astou@exemple.sn')->assertJsonPath('data.last_name', null);
        $this->assertDatabaseHas('customers', ['phone' => '764443311', 'email' => 'astou@exemple.sn']);
        $this->assertDatabaseMissing('customers', ['phone' => '764443322']);

        // Une fois l'e-mail là, le changer passe par le salon : le champ est ignoré
        $this->patchJson('/api/v1/me/profile', ['first_name' => 'Astou', 'phone' => '764443311', 'email' => 'autre@exemple.sn'])->assertOk()->assertJsonPath('data.email', 'astou@exemple.sn');
        // Le numéro d'une autre fiche cliente est refusé proprement
        $this->patchJson('/api/v1/me/profile', ['first_name' => 'Astou', 'phone' => '770000003'])->assertUnprocessable()->assertJsonPath('errors.phone.0', 'Ce numéro est déjà utilisé.');
    }

    public function test_mot_de_passe_verification_renforcee(): void
    {
        $base = ['first_name' => 'Soukey', 'phone' => '76 333 22 11', 'consent' => true];
        $error = fn (string $password, ?string $confirmation = null) => $this->postJson('/api/v1/auth/register', [...$base, 'password' => $password, 'password_confirmation' => $confirmation ?? $password])
            ->assertUnprocessable()->json('errors.password.0');

        $this->assertSame('Les mots de passe ne correspondent pas.', $error('Lancement-2026', 'Lancement-2027'));
        $this->assertStringContainsString('10', $error('Court-1')); // 10 caractères minimum
        $this->assertSame('Le mot de passe doit contenir au moins une majuscule et une minuscule.', $error('lancement-2026'));
        $this->assertSame('Le mot de passe ne doit pas contenir votre numéro de téléphone.', $error('Dabo-763332211'));
        $this->assertSame('Le mot de passe ne doit pas contenir votre prénom.', $error('Soukey-2026x'));
        $this->postJson('/api/v1/auth/register', [...$base, 'password' => 'Lancement-2026', 'password_confirmation' => 'Lancement-2026'])->assertCreated();
    }
}
