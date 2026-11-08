<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Étape 13 : notifications et satisfaction client.
 * (bookings.reminder_sent_at, qui marque le rappel de la veille, existe depuis l'étape 3.)
 * - satisfaction_surveys : une enquête par prestation terminée ou commande livrée.
 *   La même ligne porte la réponse (note, NPS, commentaire) et, si la cliente l'accepte, l'avis publié.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('satisfaction_surveys', function (Blueprint $table) {
            $table->id();
            // Seule l'empreinte SHA-256 du lien est stockée : une fuite de la base ne donne pas les liens.
            $table->char('token_hash', 64)->unique();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('booking_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('order_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->enum('kind', ['booking', 'order']);
            $table->string('subject_label', 191); // instantané : « Micro twist » ou « Commande CMD-2026-000012 »
            $table->foreignId('service_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('stylist_id')->nullable()->constrained()->nullOnDelete();
            $table->dateTime('sent_at');
            $table->dateTime('expires_at');
            $table->dateTime('answered_at')->nullable()->index();
            $table->unsignedTinyInteger('rating')->nullable();   // 1 à 5 étoiles
            $table->unsignedTinyInteger('nps')->nullable();      // 0 à 10 : « recommanderiez-vous ? »
            $table->text('comment')->nullable();
            $table->boolean('publish_consent')->default(false);
            $table->enum('review_status', ['none', 'pending', 'approved', 'rejected'])->default('none')->index();
            $table->string('reject_reason', 191)->nullable();
            $table->text('reply')->nullable();                   // réponse publique du salon
            $table->foreignId('moderated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('moderated_at')->nullable();
            $table->dateTime('follow_up_done_at')->nullable();   // note basse : la cliente a été rappelée
            $table->string('follow_up_note', 500)->nullable();
            $table->timestamps();
            $table->index(['customer_id', 'sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('satisfaction_surveys');
    }
};
