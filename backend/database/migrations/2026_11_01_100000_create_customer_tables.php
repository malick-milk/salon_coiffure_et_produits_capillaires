<?php

use App\Enums\CustomerType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** DOMAINE 2 — Clients (inscrits OU invités), adresses et zones de livraison */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_zones', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->unsignedInteger('fee')->default(0); // frais de livraison en XOF
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Le client MÉTIER : celui qui achète ou réserve, avec ou sans compte (DATABASE.md §3.1)
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete(); // NULL = invité
            $table->enum('customer_type', CustomerType::values())->default(CustomerType::Individual->value);
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('phone', 20)->unique(); // identifiant naturel d'un invité
            $table->string('email', 191)->nullable()->index();
            $table->boolean('marketing_consent')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index('created_at');
        });

        Schema::create('addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('delivery_zone_id')->nullable()->constrained()->nullOnDelete();
            $table->string('label', 50)->nullable();
            $table->string('recipient_name', 150);
            $table->string('phone', 20);
            $table->string('city', 100);
            $table->string('district', 100)->nullable();
            $table->string('address_line');
            $table->string('landmark')->nullable(); // point de repère
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('addresses');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('delivery_zones');
    }
};
