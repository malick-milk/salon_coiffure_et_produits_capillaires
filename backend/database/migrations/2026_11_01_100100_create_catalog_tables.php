<?php

use App\Support\Check;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** DOMAINE 3a — Catalogue : catégories, marques, types de cheveux, produits, images */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('categories')->restrictOnDelete(); // sous-catégories
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->text('description')->nullable();
            $table->string('image_path')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->string('logo_path')->nullable();
            $table->boolean('is_house_brand')->default(false); // marque fabriquée par l'entreprise (Dabo Hair)
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('hair_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80);
            $table->string('slug', 100)->unique();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('variant_of_id')->nullable()->constrained('products')->nullOnDelete(); // autre contenance
            $table->string('sku', 64)->unique();
            $table->string('name', 191);
            $table->string('slug', 191)->unique();
            $table->string('short_description', 500)->nullable();
            $table->text('description')->nullable();
            $table->string('unit_size', 50)->nullable();
            $table->unsignedInteger('price'); // prix de vente TTC en XOF (entier)
            $table->unsignedInteger('compare_at_price')->nullable();
            $table->decimal('cost_price', 10, 2)->nullable(); // coût unitaire CALCULÉ : jamais exposé au public
            $table->unsignedInteger('stock_quantity')->default(0); // cache du grand livre (ADR-006)
            $table->unsignedInteger('low_stock_threshold')->default(5);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->string('meta_title', 191)->nullable();
            $table->string('meta_description', 320)->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['is_active', 'category_id', 'price'], 'products_catalog_index');
            $table->index(['is_featured', 'is_active']);
            $table->fullText(['name', 'short_description']);
        });
        Check::add('products', 'products_compare_price_chk', 'compare_at_price IS NULL OR compare_at_price > price');

        Schema::create('product_hair_type', function (Blueprint $table) {
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('hair_type_id')->constrained()->cascadeOnDelete();
            $table->primary(['product_id', 'hair_type_id']);
        });

        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('alt_text', 191)->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
            $table->index(['product_id', 'position']);
        });
    }

    public function down(): void
    {
        foreach (['product_images', 'product_hair_type', 'products', 'hair_types', 'brands', 'categories'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
