<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rappels de resserrage (maquette validée le 16 novembre 2026) : dans l'espace client et par e-mail,
 * jamais par SMS pour l'instant.
 *
 * - services.resserrage_service_id : le resserrage qui correspond à un twist (micro twist -> resserrage micro twist)
 * - services.resserrage_after_days : délai conseillé par Awa. NULL = pas de rappel (tant qu'Awa ne l'a pas donné)
 * - bookings.resserrage_reminded_at / resserrage_snoozed_at : un seul rappel par twist, un seul report d'une semaine
 * - customers.resserrage_opt_out : la cliente a demandé à ne plus recevoir ces rappels (lien dans chaque e-mail)
 * - notifications : la table standard de Laravel (canal « database ») = la rubrique « Notifications » du profil
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->foreignId('resserrage_service_id')->nullable()->after('position')->constrained('services')->nullOnDelete();
            $table->unsignedSmallInteger('resserrage_after_days')->nullable()->after('resserrage_service_id');
        });
        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('resserrage_reminded_at')->nullable()->after('reminder_sent_at');
            $table->timestamp('resserrage_snoozed_at')->nullable()->after('resserrage_reminded_at');
        });
        Schema::table('customers', function (Blueprint $table) {
            $table->boolean('resserrage_opt_out')->default(false)->after('marketing_consent');
        });
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->json('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::table('customers', fn (Blueprint $t) => $t->dropColumn('resserrage_opt_out'));
        Schema::table('bookings', fn (Blueprint $t) => $t->dropColumn(['resserrage_reminded_at', 'resserrage_snoozed_at']));
        Schema::table('services', function (Blueprint $table) {
            $table->dropConstrainedForeignId('resserrage_service_id');
            $table->dropColumn('resserrage_after_days');
        });
    }
};
