<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Compteurs des références lisibles (CMD-2026-000010, RDV-2026-000011…), un par type et par année.
 * Lu et incrémenté sous VERROU dans une transaction : deux commandes simultanées ne peuvent
 * pas recevoir le même numéro (même principe que invoice_sequences, DATABASE.md §6.4).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('counters', function (Blueprint $table) {
            $table->string('name', 30); // 'order', 'booking'
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('last_number')->default(0);
            $table->primary(['name', 'year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('counters');
    }
};
