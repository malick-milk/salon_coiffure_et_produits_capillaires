<?php

use App\Support\Check;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lancement du 15 décembre 2026 (maquettes « prix membre » validées le 18 novembre 2026).
 *
 * 1. GAMME = article composé : product_bundle_items dit quels produits (et combien) une gamme contient.
 *    Une gamme n'a pas de stock à elle : on la vend tant que ses composants sont en stock, et chaque
 *    vente retire ses composants du grand livre.
 * 2. PRIX MEMBRE : products.member_price (prix réservé aux clientes connectées) et member_price_limit
 *    (combien d'unités à ce prix, ex. 20). order_items.regular_unit_price garde le prix normal quand
 *    le prix membre a été appliqué : c'est ce qui permet de compter les gammes déjà vendues au prix
 *    membre, et de vérifier « une par compte ».
 * 3. INSCRIPTION RAPIDE : prénom, téléphone, mot de passe. Le nom et l'e-mail deviennent facultatifs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('is_bundle')->default(false)->after('origin');
            $table->unsignedInteger('member_price')->nullable()->after('compare_at_price');
            $table->unsignedInteger('member_price_limit')->nullable()->after('member_price');
        });
        Check::add('products', 'products_member_price_chk', 'member_price IS NULL OR member_price < price');

        Schema::create('product_bundle_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('component_id')->constrained('products')->restrictOnDelete();
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->timestamps();
            $table->unique(['bundle_id', 'component_id']);
        });
        Check::add('product_bundle_items', 'pbi_quantity_chk', 'quantity > 0');
        Check::add('product_bundle_items', 'pbi_not_self_chk', 'bundle_id <> component_id');

        Schema::table('order_items', function (Blueprint $table) {
            $table->unsignedInteger('regular_unit_price')->nullable()->after('unit_price'); // non nul = prix membre appliqué
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('last_name', 100)->nullable()->change();
            $table->string('email', 191)->nullable()->change(); // l'index unique reste : plusieurs NULL sont permis
        });
        Schema::table('customers', function (Blueprint $table) {
            $table->string('last_name', 100)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('order_items', fn (Blueprint $table) => $table->dropColumn('regular_unit_price'));
        Schema::dropIfExists('product_bundle_items');
        Check::drop('products', 'products_member_price_chk');
        Schema::table('products', fn (Blueprint $table) => $table->dropColumn(['is_bundle', 'member_price', 'member_price_limit']));
        // Le nom et l'e-mail restent facultatifs : les rendre obligatoires échouerait sur les comptes déjà créés sans eux
    }
};
