<?php

use App\Support\Check;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CONTRATS ET RH (maquette validée le 26 novembre 2026).
 *
 * employees            : la personne (identité, n° CNI / IPRES / CSS CHIFFRÉS en base : colonnes text + cast « encrypted »).
 * employment_contracts : ses contrats successifs (CDD puis CDI…) ; previous_contract_id relie un CDI à son CDD.
 * employee_documents   : contrat signé, CNI… stockés sur le disque PRIVÉ (storage/app/private), jamais publics.
 * employee_leaves      : congés pris.
 * Accès : permission hr.manage, donnée à la propriétaire seulement (salaires et pièces d'identité confidentiels).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('phone', 20)->nullable();
            $table->date('birth_date')->nullable();
            $table->string('address', 191)->nullable();
            $table->text('id_number')->nullable();     // CNI, chiffrée
            $table->text('ipres_number')->nullable();  // chiffré
            $table->text('css_number')->nullable();    // chiffré
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();      // son compte ERP
            $table->foreignId('stylist_id')->nullable()->constrained()->nullOnDelete();   // sa fiche planning (commission)
            $table->timestamps();
        });

        Schema::create('employment_contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['cdi', 'cdd', 'apprentissage', 'stage', 'prestataire']);
            $table->string('position', 100);
            $table->date('starts_on');
            $table->date('ends_on')->nullable();          // fin prévue (CDD, apprentissage, stage)
            $table->date('trial_ends_on')->nullable();    // fin de la période d'essai
            $table->unsignedTinyInteger('weekly_hours')->nullable();
            $table->string('work_days', 60)->nullable();
            $table->unsignedInteger('base_salary')->nullable();               // F CFA par mois (indemnité pour l'apprentie)
            $table->decimal('commission_rate', 5, 2)->default(0);             // % de SES prestations réalisées
            $table->enum('pay_method', ['cash', 'wave', 'orange_money', 'free_money', 'bank'])->nullable();
            $table->unsignedTinyInteger('renewal_count')->default(0);
            $table->date('signed_on')->nullable();
            $table->date('ended_on')->nullable();         // fin RÉELLE (null = en cours)
            $table->enum('end_reason', ['converted', 'end_of_term', 'resigned', 'dismissed', 'trial', 'other'])->nullable();
            $table->string('end_note', 191)->nullable();
            $table->foreignId('previous_contract_id')->nullable()->constrained('employment_contracts')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['ended_on', 'ends_on']);
        });
        Check::add('employment_contracts', 'employment_contracts_dates_chk', 'ends_on IS NULL OR ends_on >= starts_on');
        Check::add('employment_contracts', 'employment_contracts_commission_chk', 'commission_rate BETWEEN 0 AND 100');

        Schema::create('employee_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employment_contract_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('kind', ['contract', 'id_card', 'other']);
            $table->string('original_name', 191);
            $table->string('path', 191);
            $table->string('mime', 60);
            $table->unsignedInteger('size');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('employee_leaves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->enum('kind', ['paid', 'maternity', 'sick', 'other'])->default('paid');
            $table->date('starts_on');
            $table->date('ends_on');
            $table->decimal('days', 4, 1);
            $table->string('note', 191)->nullable();
            $table->timestamps();
        });
        Check::add('employee_leaves', 'employee_leaves_dates_chk', 'ends_on >= starts_on');
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_leaves');
        Schema::dropIfExists('employee_documents');
        Schema::dropIfExists('employment_contracts');
        Schema::dropIfExists('employees');
    }
};
