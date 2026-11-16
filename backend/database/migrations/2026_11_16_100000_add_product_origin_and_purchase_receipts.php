<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ajout d'un produit depuis l'ERP (maquette validée le 16 novembre 2026).
 *
 * - products.origin : « made » = fabriqué par Dabo Hair (le stock entre par la Fabrication),
 *   « resold » = acheté et revendu (le stock entre par une Réception d'achat). Les produits
 *   existants sont tous fabriqués par Dabo Hair : valeur par défaut « made ».
 * - purchase_receipts : une réception d'achat chez un fournisseur. Le coût unitaire de la réception
 *   (prix d'achat + part des frais du lot) alimente le coût de revient moyen pondéré du produit.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->enum('origin', ['made', 'resold'])->default('made')->after('variant_of_id');
        });

        Schema::create('purchase_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->string('supplier_name', 150);
            $table->string('supplier_invoice', 60)->nullable();
            $table->date('received_on');
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('unit_price');          // prix d'achat unitaire en XOF
            $table->unsignedInteger('extra_costs')->default(0); // frais du lot : transport, douane
            $table->decimal('unit_cost', 10, 2);           // (quantité × prix + frais) ÷ quantité
            $table->string('notes', 500)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['product_id', 'received_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_receipts');
        Schema::table('products', fn (Blueprint $table) => $table->dropColumn('origin'));
    }
};
