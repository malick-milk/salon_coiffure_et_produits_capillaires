<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SUIVI DES ERREURS, hébergé sur notre serveur (21 novembre 2026).
 * Une ligne par erreur DIFFÉRENTE (empreinte) : les répétitions incrémentent le compteur.
 * Les données sensibles (e-mails, téléphones, jetons) sont masquées avant l'enregistrement.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('error_reports', function (Blueprint $table) {
            $table->id();
            $table->enum('source', ['server', 'browser']);
            $table->char('fingerprint', 64)->unique();      // sha256 de la source + type + message + emplacement
            $table->string('type', 191);                     // classe de l'exception, ou « TypeError » côté navigateur
            $table->string('message', 500);
            $table->string('location', 300)->nullable();     // fichier:ligne (serveur) ou page (navigateur)
            $table->json('context')->nullable();             // route, méthode, navigateur, extrait de la pile
            $table->unsignedInteger('occurrences')->default(1);
            $table->timestamp('first_seen_at');
            $table->timestamp('last_seen_at');
            $table->timestamp('notified_at')->nullable();    // dernier e-mail envoyé pour cette erreur
            $table->timestamps();
            $table->index('last_seen_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('error_reports');
    }
};
