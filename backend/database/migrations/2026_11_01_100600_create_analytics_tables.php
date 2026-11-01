<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** DOMAINE 7 — Analytics : dimension calendrier, agrégats quotidiens, prévisions (ADR-008) */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calendar_dates', function (Blueprint $table) {
            $table->date('date')->primary();
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('quarter');
            $table->unsignedTinyInteger('month');
            $table->unsignedTinyInteger('iso_week');
            $table->unsignedTinyInteger('day_of_month');
            $table->unsignedTinyInteger('day_of_week'); // 1 = lundi
            $table->boolean('is_weekend');
            $table->index(['year', 'month']);
        });

        Schema::create('daily_sales_snapshots', function (Blueprint $table) {
            $table->date('date')->primary();
            $table->unsignedInteger('orders_count')->default(0);
            $table->unsignedInteger('items_sold')->default(0);
            $table->unsignedBigInteger('products_revenue')->default(0);
            $table->unsignedBigInteger('products_cost')->default(0);
            $table->bigInteger('gross_margin')->default(0);
            $table->unsignedInteger('bookings_count')->default(0);
            $table->unsignedInteger('bookings_completed')->default(0);
            $table->unsignedInteger('bookings_no_show')->default(0);
            $table->unsignedBigInteger('services_revenue')->default(0);
            $table->unsignedInteger('new_customers')->default(0);
            $table->timestamp('computed_at')->nullable();
            $table->foreign('date')->references('date')->on('calendar_dates');
        });

        Schema::create('daily_product_stats', function (Blueprint $table) {
            $table->date('date');
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity_sold')->default(0);
            $table->unsignedBigInteger('revenue')->default(0);
            $table->unsignedBigInteger('cost')->default(0);
            $table->unsignedInteger('stock_end')->default(0);
            $table->timestamp('computed_at')->nullable();
            $table->primary(['date', 'product_id']);
            $table->index(['product_id', 'date']);
            $table->foreign('date')->references('date')->on('calendar_dates');
        });

        Schema::create('forecasts', function (Blueprint $table) {
            $table->id();
            $table->string('metric', 50);
            $table->foreignId('product_id')->nullable()->constrained()->cascadeOnDelete();
            $table->date('target_date');
            $table->decimal('predicted_value', 14, 2);
            $table->decimal('lower_bound', 14, 2)->nullable();
            $table->decimal('upper_bound', 14, 2)->nullable();
            $table->string('model_name', 100);
            $table->string('model_version', 50);
            $table->dateTime('generated_at');
            $table->index(['metric', 'product_id', 'target_date']);
        });
    }

    public function down(): void
    {
        foreach (['forecasts', 'daily_product_stats', 'daily_sales_snapshots', 'calendar_dates'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
