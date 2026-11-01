<?php

use App\Enums\BookingSource;
use App\Enums\BookingStatus;
use App\Support\Check;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** DOMAINE 5 — Salon : prestations, coiffeurs, horaires, fermetures, réservations */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_category_id')->constrained()->restrictOnDelete();
            $table->string('name', 150);
            $table->string('slug', 170)->unique();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('duration_minutes');
            $table->unsignedSmallInteger('buffer_minutes')->default(0); // nettoyage après la prestation
            $table->unsignedInteger('price');
            $table->string('image_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['service_category_id', 'is_active']);
        });
        Check::add('services', 'services_duration_chk', 'duration_minutes > 0');

        Schema::create('stylists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('display_name', 100);
            $table->text('bio')->nullable();
            $table->string('photo_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('service_stylist', function (Blueprint $table) {
            $table->foreignId('service_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stylist_id')->constrained()->cascadeOnDelete();
            $table->primary(['service_id', 'stylist_id']);
        });

        Schema::create('business_hours', function (Blueprint $table) {
            $table->id();
            $table->unsignedTinyInteger('day_of_week')->unique(); // 1 = lundi … 7 = dimanche
            $table->boolean('is_closed')->default(false);
            $table->time('opens_at')->nullable();
            $table->time('closes_at')->nullable();
            $table->time('break_start')->nullable();
            $table->time('break_end')->nullable();
            $table->timestamps();
        });
        Check::add('business_hours', 'business_hours_day_chk', 'day_of_week BETWEEN 1 AND 7');
        Check::add('business_hours', 'business_hours_open_chk', 'is_closed = TRUE OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at)');
        Check::add('business_hours', 'business_hours_break_chk', 'break_start IS NULL OR (break_end IS NOT NULL AND break_start < break_end)');

        Schema::create('closures', function (Blueprint $table) {
            $table->id();
            $table->date('starts_on');
            $table->date('ends_on');
            $table->string('reason', 191)->nullable();
            $table->timestamps();
            $table->index(['starts_on', 'ends_on']);
        });
        Check::add('closures', 'closures_period_chk', 'starts_on <= ends_on');

        Schema::create('stylist_time_off', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stylist_id')->constrained()->cascadeOnDelete();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('reason', 191)->nullable();
            $table->timestamps();
            $table->index(['stylist_id', 'starts_at', 'ends_at']);
        });
        Check::add('stylist_time_off', 'sto_period_chk', 'starts_at < ends_at');

        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->unique();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->foreignId('service_id')->constrained()->restrictOnDelete();
            $table->foreignId('stylist_id')->constrained()->restrictOnDelete();
            $table->enum('source', BookingSource::values())->default(BookingSource::Online->value);
            $table->enum('status', BookingStatus::values())->default(BookingStatus::Pending->value);
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('service_name', 150); // instantanés
            $table->unsignedSmallInteger('duration_minutes');
            $table->unsignedInteger('price');
            $table->string('customer_notes', 500)->nullable();
            $table->string('admin_notes', 500)->nullable();
            $table->string('cancellation_reason')->nullable();
            $table->enum('cancelled_by', ['customer', 'staff', 'system'])->nullable();
            $table->dateTime('confirmed_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->dateTime('cancelled_at')->nullable();
            $table->dateTime('reminder_sent_at')->nullable();
            $table->timestamps();
            // Colonne générée + index unique : deux réservations ACTIVES ne peuvent pas commencer
            // au même instant pour le même coiffeur (DATABASE.md §3.5)
            $table->dateTime('active_slot')->nullable()->storedAs("IF(status IN ('pending','confirmed'), starts_at, NULL)");
            $table->unique(['stylist_id', 'active_slot']);
            $table->index(['stylist_id', 'starts_at', 'ends_at']);
            $table->index(['status', 'starts_at']);
            $table->index(['customer_id', 'starts_at']);
        });
        Check::add('bookings', 'bookings_period_chk', 'starts_at < ends_at');
    }

    public function down(): void
    {
        foreach (['bookings', 'stylist_time_off', 'closures', 'business_hours', 'service_stylist', 'stylists', 'services', 'service_categories'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
