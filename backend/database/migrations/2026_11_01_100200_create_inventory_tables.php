<?php

use App\Enums\ProductionCostCategory;
use App\Enums\StockMovementType;
use App\Support\Check;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** DOMAINE 3b — Stock : grand livre, fabrication (lots et coûts), achats fournisseurs */
return new class extends Migration
{
    public function up(): void
    {
        // GRAND LIVRE DU STOCK : une ligne par variation, jamais modifiée ni supprimée (ADR-006)
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->enum('type', StockMovementType::values());
            $table->integer('quantity'); // SIGNÉE : +10 entrée, -2 sortie
            $table->unsignedInteger('stock_after');
            $table->unsignedInteger('unit_cost')->nullable();
            $table->nullableMorphs('reference'); // origine : commande, lot de fabrication, achat…
            $table->string('reason')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->index(['product_id', 'created_at']);
            $table->index(['type', 'created_at']);
        });
        Check::add('stock_movements', 'stock_movements_quantity_chk', 'quantity <> 0');

        Schema::create('production_batches', function (Blueprint $table) {
            $table->id();
            $table->string('batch_number', 40)->unique(); // traçabilité cosmétique
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity_produced');
            $table->unsignedBigInteger('total_cost')->nullable(); // montant payé (somme des postes)
            // Coût unitaire CALCULÉ par MySQL : on stocke le total exact, on dérive l'unitaire
            $table->decimal('unit_cost', 12, 2)->storedAs('total_cost / quantity_produced');
            $table->date('produced_on');
            $table->date('expires_on')->nullable()->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['product_id', 'produced_on']);
        });
        Check::add('production_batches', 'production_batches_quantity_chk', 'quantity_produced > 0');
        Check::add('production_batches', 'production_batches_expiry_chk', 'expires_on IS NULL OR expires_on > produced_on');

        Schema::create('production_batch_costs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_batch_id')->constrained()->cascadeOnDelete();
            $table->enum('category', ProductionCostCategory::values())->index();
            $table->string('label', 150);
            $table->unsignedInteger('amount');
            $table->date('spent_on')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
        Check::add('production_batch_costs', 'pbc_amount_chk', 'amount > 0');

        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150)->unique();
            $table->string('contact_name', 150)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('email', 191)->nullable();
            $table->string('address')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->unique();
            $table->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $table->enum('status', ['draft', 'ordered', 'partially_received', 'received', 'cancelled'])->default('draft')->index();
            $table->unsignedBigInteger('total_cost')->default(0);
            $table->dateTime('ordered_at')->nullable();
            $table->date('expected_at')->nullable();
            $table->dateTime('received_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['supplier_id', 'ordered_at']);
        });

        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('packs_ordered'); // ex. 4 douzaines
            $table->unsignedInteger('units_per_pack')->default(12);
            $table->unsignedInteger('unit_cost');
            $table->unsignedInteger('quantity_ordered')->storedAs('packs_ordered * units_per_pack');
            $table->unsignedBigInteger('line_total')->storedAs('packs_ordered * units_per_pack * unit_cost');
            $table->unsignedInteger('quantity_received')->default(0);
            $table->timestamps();
            $table->unique(['purchase_order_id', 'product_id']);
        });
        Check::add('purchase_order_items', 'poi_packs_chk', 'packs_ordered > 0 AND units_per_pack > 0');
        Check::add('purchase_order_items', 'poi_received_chk', 'quantity_received <= packs_ordered * units_per_pack');
    }

    public function down(): void
    {
        foreach (['purchase_order_items', 'purchase_orders', 'suppliers', 'production_batch_costs', 'production_batches', 'stock_movements'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
