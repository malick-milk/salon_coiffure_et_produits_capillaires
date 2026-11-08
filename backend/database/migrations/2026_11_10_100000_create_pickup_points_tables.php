<?php

use App\Enums\FulfillmentMethod;
use App\Enums\OrderChannel;
use App\Enums\StockMovementType;
use App\Support\Check;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Étape 14 : points de retrait partenaires (boutiques existantes dans les régions).
 *
 * Principe du DÉPÔT-VENTE : les produits livrés au partenaire restent à Dabo Hair.
 * - pickup_point_stocks : ce que chaque partenaire détient, produit par produit (stock « attendu »).
 * - pickup_point_movements : le grand livre de ce stock (livraison, retrait d'une commande en ligne,
 *   vente au comptoir constatée au relevé, abîmé), comme stock_movements pour le stock principal.
 * - consignment_deliveries : les bons de dépôt (une livraison mensuelle).
 * - consignment_statements : les relevés mensuels (comptage, ventes, commission, montant dû avant le 5).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pickup_points', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);                 // « Boutique de Moussa Diop »
            $table->string('owner_name', 150);
            $table->string('phone', 20);
            $table->string('email', 191)->nullable();
            $table->json('regions');                     // ["Ziguinchor", "Sédhiou", "Kolda"] : un partenaire peut couvrir plusieurs régions
            $table->string('city', 100);
            $table->string('address', 255);
            $table->string('opening_hours', 191)->nullable();
            $table->decimal('commission_rate', 5, 2)->default(10.00); // en %
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete(); // fiche client des ventes au comptoir
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('pickup_point_stocks', function (Blueprint $table) {
            $table->foreignId('pickup_point_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity')->default(0); // UNSIGNED : jamais négatif
            $table->timestamps();
            $table->primary(['pickup_point_id', 'product_id']);
        });

        Schema::create('consignment_deliveries', function (Blueprint $table) {
            $table->id();
            $table->string('number', 30)->unique();      // BD-2026-000014
            $table->foreignId('pickup_point_id')->constrained()->restrictOnDelete();
            $table->date('delivered_on');
            $table->unsignedInteger('total_quantity');
            $table->unsignedInteger('total_value');      // au prix du site le jour de la livraison
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('consignment_delivery_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consignment_delivery_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->string('product_name', 191);
            $table->unsignedInteger('unit_price');
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('line_total');
        });

        Schema::create('consignment_statements', function (Blueprint $table) {
            $table->id();
            $table->string('number', 30)->unique();      // REL-2026-000003
            $table->foreignId('pickup_point_id')->constrained()->restrictOnDelete();
            $table->char('period', 7);                   // « 2026-10 »
            $table->unsignedInteger('counter_sales_total');
            $table->unsignedInteger('online_sales_total'); // commandes en ligne remises par le partenaire (il a encaissé)
            $table->unsignedInteger('sales_total');
            $table->decimal('commission_rate', 5, 2);
            $table->unsignedInteger('commission_gross');
            $table->unsignedInteger('damaged_value');
            $table->unsignedInteger('commission_net');   // jamais négative : plafonnée à 0 (règle du 9 novembre)
            $table->unsignedInteger('amount_due');
            $table->date('due_date');                    // le 5 du mois suivant
            $table->unsignedInteger('declared_sold')->nullable(); // ce que le partenaire a déclaré
            $table->string('gap_note', 500)->nullable();
            $table->foreignId('counter_order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->dateTime('paid_at')->nullable();
            $table->string('payment_method', 30)->nullable();
            $table->foreignId('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['pickup_point_id', 'period']); // un seul relevé par partenaire et par mois
        });

        Schema::create('consignment_statement_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consignment_statement_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->string('product_name', 191);
            $table->unsignedInteger('unit_price');
            $table->unsignedInteger('expected_qty');     // stock attendu (livraisons − retraits en ligne)
            $table->unsignedInteger('counted_qty');      // compté dans la boutique
            $table->unsignedInteger('damaged_qty');
            $table->unsignedInteger('counter_sold_qty'); // = attendu − compté − abîmés
            $table->unsignedInteger('online_qty');       // remis aux clientes en ligne depuis le dernier relevé
        });

        Schema::create('pickup_point_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pickup_point_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->enum('type', ['delivery', 'online_order', 'online_order_cancelled', 'counter_sale', 'damaged']);
            $table->integer('quantity');                 // signé : + entrée, − sortie
            $table->unsignedInteger('balance_after');
            $table->nullableMorphs('reference');         // bon de dépôt, commande ou relevé
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['pickup_point_id', 'product_id', 'created_at'], 'ppm_point_product_date_idx');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->enum('channel', OrderChannel::values())->default(OrderChannel::Online->value)->change();
            $table->enum('fulfillment_method', FulfillmentMethod::values())->change();
            $table->foreignId('pickup_point_id')->nullable()->after('delivery_zone_id')->constrained()->restrictOnDelete();
            $table->char('pickup_code', 4)->nullable()->after('pickup_point_id');            // donné par la cliente au partenaire
            $table->char('handover_token_hash', 64)->nullable()->unique()->after('pickup_code'); // lien envoyé au partenaire
            $table->dateTime('picked_up_at')->nullable()->after('delivered_at');
            $table->foreignId('consignment_statement_id')->nullable()->after('picked_up_at')->constrained()->nullOnDelete();
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->enum('type', StockMovementType::values())->change();
        });

        // Règle protégée par la base : une livraison a une adresse, un retrait en point partenaire a un point
        Check::drop('orders', 'orders_delivery_chk');
        Check::add('orders', 'orders_delivery_chk', "fulfillment_method = 'pickup' OR (fulfillment_method = 'pickup_point' AND pickup_point_id IS NOT NULL) OR (fulfillment_method = 'delivery' AND shipping_address IS NOT NULL)");
    }

    public function down(): void
    {
        Check::drop('orders', 'orders_delivery_chk');
        Check::add('orders', 'orders_delivery_chk', "fulfillment_method = 'pickup' OR shipping_address IS NOT NULL");
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('consignment_statement_id');
            $table->dropConstrainedForeignId('pickup_point_id');
            $table->dropUnique(['handover_token_hash']);
            $table->dropColumn(['pickup_code', 'handover_token_hash', 'picked_up_at']);
        });
        Schema::dropIfExists('pickup_point_movements');
        Schema::dropIfExists('consignment_statement_items');
        Schema::dropIfExists('consignment_statements');
        Schema::dropIfExists('consignment_delivery_items');
        Schema::dropIfExists('consignment_deliveries');
        Schema::dropIfExists('pickup_point_stocks');
        Schema::dropIfExists('pickup_points');
    }
};
