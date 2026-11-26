<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * DÉMO SEULEMENT (local et tests) : une petite équipe pour voir les écrans « Contrats et RH » et leurs alertes.
 * Personnes et montants FICTIFS. En production, la gérante saisit les vrais contrats.
 */
class DemoHrSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing']) || Employee::query()->exists()) {
            return;
        }
        $admin = User::where('email', 'admin@dabohair.test')->value('id');
        $today = now()->startOfDay();
        $team = [
            // Fin de CDD dans 18 jours (CDD de 12 mois, jamais renouvelé)
            [['first_name' => 'Fatou', 'last_name' => 'Ndiaye', 'phone' => '771234567'],
                ['type' => 'cdd', 'position' => 'Coiffeuse', 'starts_on' => $today->copy()->addDays(18)->subYear()->addDay(), 'ends_on' => $today->copy()->addDays(18),
                    'trial_ends_on' => $today->copy()->addDays(18)->subYear()->addMonth(), 'weekly_hours' => 40, 'work_days' => 'Lundi au samedi',
                    'base_salary' => 90000, 'commission_rate' => 10, 'pay_method' => 'wave', 'signed_on' => $today->copy()->addDays(18)->subYear()]],
            // Période d'essai qui finit dans 7 jours
            [['first_name' => 'Khady', 'last_name' => 'Sarr', 'phone' => '781112233'],
                ['type' => 'cdi', 'position' => 'Caissière', 'starts_on' => $today->copy()->subDays(23), 'trial_ends_on' => $today->copy()->addDays(7),
                    'weekly_hours' => 40, 'work_days' => 'Lundi au samedi', 'base_salary' => 80000, 'pay_method' => 'wave', 'signed_on' => $today->copy()->subDays(24)]],
            // Contrat pas encore signé
            [['first_name' => 'Mariama', 'last_name' => 'Diop', 'phone' => '765554433'],
                ['type' => 'apprentissage', 'position' => 'Apprentie coiffeuse', 'starts_on' => $today->copy()->subDays(56), 'ends_on' => $today->copy()->subDays(56)->addYear()->subDay(),
                    'weekly_hours' => 40, 'work_days' => 'Lundi au samedi', 'base_salary' => 30000, 'pay_method' => 'cash']],
            // Livreur prestataire
            [['first_name' => 'Ousmane', 'last_name' => 'Fall', 'phone' => '779998877'],
                ['type' => 'prestataire', 'position' => 'Livreur', 'starts_on' => $today->copy()->subDays(25), 'pay_method' => 'wave', 'signed_on' => $today->copy()->subDays(25)]],
        ];
        foreach ($team as [$person, $contract]) {
            Employee::create($person)->contracts()->create([...$contract, 'created_by' => $admin]);
        }
    }
}
