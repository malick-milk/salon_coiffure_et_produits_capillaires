<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Étape 8 — qualité des données analytiques.
 * Un coût de revient INCONNU ne doit jamais être compté comme 0 (la marge serait fausse).
 * - costed_revenue : part du CA dont le coût est connu, base honnête du taux de marge ;
 * - daily_product_stats.cost devient NULL quand une vente du jour a un coût inconnu.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_sales_snapshots', function (Blueprint $table) {
            $table->unsignedBigInteger('costed_revenue')->default(0)->after('products_revenue');
        });
        Schema::table('daily_product_stats', function (Blueprint $table) {
            $table->unsignedBigInteger('cost')->nullable()->default(null)->change();
        });
    }

    public function down(): void
    {
        Schema::table('daily_sales_snapshots', fn (Blueprint $table) => $table->dropColumn('costed_revenue'));
        Schema::table('daily_product_stats', fn (Blueprint $table) => $table->unsignedBigInteger('cost')->default(0)->nullable(false)->change());
    }
};
