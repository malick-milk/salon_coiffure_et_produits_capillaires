<?php

use App\Enums\FulfillmentMethod;
use App\Enums\OrderChannel;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Support\Check;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** DOMAINE 4 — Commandes, paniers, paiements, factures */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->unique(); // CMD-2026-000123
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete(); // vente en boutique
            $table->enum('channel', OrderChannel::values())->default(OrderChannel::Online->value);
            $table->enum('status', OrderStatus::values())->default(OrderStatus::Pending->value);
            $table->enum('payment_status', PaymentStatus::values())->default(PaymentStatus::Unpaid->value);
            $table->enum('fulfillment_method', FulfillmentMethod::values());
            $table->foreignId('delivery_zone_id')->nullable()->constrained()->nullOnDelete();
            // Instantané de l'adresse de livraison
            $table->string('shipping_name', 150)->nullable();
            $table->string('shipping_phone', 20)->nullable();
            $table->string('shipping_city', 100)->nullable();
            $table->string('shipping_district', 100)->nullable();
            $table->string('shipping_address')->nullable();
            $table->string('shipping_landmark')->nullable();
            // Montants en XOF, recalculés par le serveur (RG-COM-04)
            $table->unsignedInteger('subtotal');
            $table->unsignedInteger('discount_total')->default(0);
            $table->unsignedInteger('shipping_fee')->default(0);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->unsignedInteger('tax_total')->default(0);
            $table->unsignedInteger('total');
            $table->string('customer_notes', 500)->nullable();
            $table->string('cancellation_reason')->nullable();
            $table->dateTime('placed_at');
            $table->dateTime('confirmed_at')->nullable();
            $table->dateTime('shipped_at')->nullable();
            $table->dateTime('delivered_at')->nullable();
            $table->dateTime('paid_at')->nullable();
            $table->dateTime('cancelled_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'placed_at']);
            $table->index(['customer_id', 'placed_at']);
            $table->index(['payment_status', 'paid_at']);
        });
        Check::add('orders', 'orders_total_chk', 'total = subtotal - discount_total + shipping_fee');
        Check::add('orders', 'orders_delivery_chk', "fulfillment_method = 'pickup' OR shipping_address IS NOT NULL");

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->string('product_name', 191); // INSTANTANÉS (RG-COM-03)
            $table->string('sku', 64);
            $table->unsignedInteger('unit_price');
            $table->decimal('unit_cost', 10, 2)->nullable();
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('line_total');
            $table->timestamps();
        });
        Check::add('order_items', 'order_items_quantity_chk', 'quantity > 0');
        Check::add('order_items', 'order_items_total_chk', 'line_total = unit_price * quantity');

        Schema::create('carts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->char('token', 36)->unique();
            $table->enum('status', ['active', 'converted', 'abandoned'])->default('active');
            $table->foreignId('converted_order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->dateTime('last_activity_at');
            $table->timestamps();
            $table->index(['user_id', 'status']);
            $table->index(['status', 'last_activity_at']);
        });

        Schema::create('cart_items', function (Blueprint $table) {
            $table->foreignId('cart_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->timestamps();
            $table->primary(['cart_id', 'product_id']);
        });
        Check::add('cart_items', 'cart_items_quantity_chk', 'quantity > 0');

        // Paiements séparés des commandes : Wave, Orange Money… s'ajouteront sans changer ce schéma (ADR-007)
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->morphs('payable'); // commande ou réservation
            $table->string('gateway', 50)->default('manual');
            $table->enum('method', PaymentMethod::values());
            $table->unsignedInteger('amount');
            $table->enum('status', ['pending', 'succeeded', 'failed', 'refunded'])->default('pending');
            $table->string('provider_reference', 191)->nullable();
            $table->json('provider_payload')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('paid_at')->nullable();
            $table->timestamps();
            $table->unique(['gateway', 'provider_reference']); // idempotence des webhooks
            $table->index(['status', 'paid_at']);
        });
        Check::add('payments', 'payments_amount_chk', 'amount > 0');

        Schema::create('invoice_sequences', function (Blueprint $table) {
            $table->unsignedSmallInteger('year');
            $table->enum('type', ['invoice', 'credit_note']);
            $table->unsignedInteger('last_number')->default(0);
            $table->primary(['year', 'type']);
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('number', 30)->unique(); // FAC-2026-000001, sans trou (RG-FAC-02)
            $table->enum('type', ['invoice', 'credit_note'])->default('invoice');
            $table->foreignId('order_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('booking_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('credited_invoice_id')->nullable()->constrained('invoices')->restrictOnDelete();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->string('customer_name', 200);
            $table->string('customer_phone', 20)->nullable();
            $table->string('customer_email', 191)->nullable();
            $table->string('billing_address', 500)->nullable();
            $table->json('company_snapshot');
            $table->unsignedInteger('subtotal');
            $table->unsignedInteger('tax_total')->default(0);
            $table->unsignedInteger('total');
            $table->dateTime('issued_at')->index();
            $table->string('pdf_path')->nullable();
            $table->timestamps();
        });
        Check::add('invoices', 'invoices_source_chk', '(order_id IS NULL) <> (booking_id IS NULL)');
        Check::add('invoices', 'invoices_credit_chk', "type = 'invoice' OR credited_invoice_id IS NOT NULL");
    }

    public function down(): void
    {
        foreach (['invoices', 'invoice_sequences', 'payments', 'cart_items', 'carts', 'order_items', 'orders'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
