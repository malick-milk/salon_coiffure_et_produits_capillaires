<?php

use App\Support\Check;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** DOMAINES 3c et 6 — Avis, favoris, messages de contact, paramètres */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete(); // « achat vérifié »
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('moderated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('moderated_at')->nullable();
            $table->timestamps();
            $table->unique(['product_id', 'customer_id']);
            $table->index(['product_id', 'status']);
        });
        Check::add('product_reviews', 'reviews_rating_chk', 'rating BETWEEN 1 AND 5');

        // Association porteuse (MCD) : clé composée, pas d'id (docs/03b §3.2)
        Schema::create('favorites', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->primary(['user_id', 'product_id']);
        });

        Schema::create('contact_messages', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('email', 191)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('subject', 191);
            $table->text('message');
            $table->string('ip_address', 45)->nullable();
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('read_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('group', 50);
            $table->string('key', 100)->unique();
            $table->json('value');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['settings', 'contact_messages', 'favorites', 'product_reviews'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
