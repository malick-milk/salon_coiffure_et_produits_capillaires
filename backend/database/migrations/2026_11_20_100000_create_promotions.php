<?php

use App\Support\Check;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PROMOTIONS EN POURCENTAGE (maquettes validées le 20 novembre 2026).
 *
 * Le prix initial du produit (products.price) ne change JAMAIS : le prix promo est calculé à la commande,
 * pendant les dates. order_items.promotion_id dit quelle promotion a servi (avec regular_unit_price = prix
 * initial) : facture claire, et résultats calculables (ventes avant / pendant).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);                     // pour l'équipe, pas affiché sur le site
            $table->unsignedTinyInteger('percent');          // 5 à 70
            $table->date('starts_on');
            $table->date('ends_on');                         // incluse
            $table->enum('audience', ['all', 'members'])->default('all');
            $table->timestamp('stopped_at')->nullable();     // « Arrêter maintenant »
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['starts_on', 'ends_on']);
        });
        Check::add('promotions', 'promotions_percent_chk', 'percent BETWEEN 5 AND 70');
        Check::add('promotions', 'promotions_dates_chk', 'ends_on >= starts_on');

        Schema::create('product_promotion', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promotion_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unique(['promotion_id', 'product_id']);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('promotion_id')->nullable()->after('regular_unit_price')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('order_items', fn (Blueprint $table) => $table->dropConstrainedForeignId('promotion_id'));
        Schema::dropIfExists('product_promotion');
        Schema::dropIfExists('promotions');
    }
};
