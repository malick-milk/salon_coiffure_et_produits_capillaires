<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ACCORD POUR LES OFFRES PAR E-MAIL (maquette validée le 28 novembre 2026, loi sénégalaise n° 2008-12).
 *
 * customers.marketing_consent garde l'état ACTUEL (oui / non). Cette table garde la PREUVE de chaque accord et
 * de chaque retrait, jamais modifiée ni effacée : date, endroit (inscription, commande, réservation, salon,
 * espace client, lien de l'e-mail), personne de la caisse s'il y a lieu, et version du texte accepté.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_consents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('channel', 30)->default('email_offers');   // e-mail ; WhatsApp en version 2
            $table->boolean('granted');                               // true = accord, false = retrait
            $table->enum('source', ['register', 'order', 'booking', 'salon', 'account', 'email_link']);
            $table->string('text_version', 20);                       // quel texte la cliente a accepté
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete(); // accord noté au salon
            $table->timestamp('created_at')->useCurrent();
            $table->index(['customer_id', 'channel', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_consents');
    }
};
