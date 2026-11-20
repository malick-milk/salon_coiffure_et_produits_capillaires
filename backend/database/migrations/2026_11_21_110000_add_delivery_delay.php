<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tarifs de livraison gérés dans l'ERP (maquette validée le 21 novembre 2026) : un délai annoncé par zone.
 * Le seuil de livraison offerte est un réglage (table settings, clé delivery.free_threshold).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_zones', function (Blueprint $table) {
            $table->string('delay_label', 40)->nullable()->after('fee'); // « Le jour même », « 24 h », « 48 à 72 h »
        });
    }

    public function down(): void
    {
        Schema::table('delivery_zones', fn (Blueprint $table) => $table->dropColumn('delay_label'));
    }
};
