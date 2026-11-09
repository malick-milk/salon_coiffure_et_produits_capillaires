<?php

namespace Database\Seeders;

use App\Models\BusinessHour;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Stylist;
use Illuminate\Database\Seeder;

/**
 * Scénario de TEST du salon (jamais chargé par DatabaseSeeder, donc jamais en production ni en local).
 * Le vrai salon n'a qu'une coiffeuse, ouverte tous les jours sans pause : trop simple pour éprouver le calcul
 * des créneaux. Ce scénario ajoute deux coiffeuses qui ne font pas les mêmes prestations, une pause de midi
 * et un jour de fermeture. Les tests qui en ont besoin l'appellent : $this->seed(SalonTestScenarioSeeder::class).
 */
class SalonTestScenarioSeeder extends Seeder
{
    public function run(): void
    {
        $tresses = ServiceCategory::updateOrCreate(['slug' => 'tresses'], ['name' => 'Tresses', 'position' => 10]);
        $soins = ServiceCategory::updateOrCreate(['slug' => 'soins'], ['name' => 'Soins', 'position' => 11]);
        foreach ([
            ['tresses-africaines', 'Tresses africaines', $tresses, 180, 15, 25000],
            ['nattes-collees', 'Nattes collées', $tresses, 90, 15, 12000],
            ['soin-profond-karite', 'Soin profond au karité', $soins, 60, 10, 8000],
        ] as $i => [$slug, $name, $category, $duration, $buffer, $price]) {
            Service::updateOrCreate(['slug' => $slug], [
                'name' => $name, 'service_category_id' => $category->id, 'duration_minutes' => $duration,
                'buffer_minutes' => $buffer, 'price' => $price, 'position' => 20 + $i, 'is_active' => true,
            ]);
        }
        // Bineta ne réalise pas les nattes collées (table service_stylist)
        $fatou = Stylist::updateOrCreate(['display_name' => 'Fatou'], []);
        $bineta = Stylist::updateOrCreate(['display_name' => 'Bineta'], []);
        $fatou->services()->sync(Service::whereIn('slug', ['tresses-africaines', 'nattes-collees', 'soin-profond-karite'])->pluck('id'));
        $bineta->services()->sync(Service::whereIn('slug', ['tresses-africaines', 'soin-profond-karite'])->pluck('id'));

        // Pause de midi (plus longue le vendredi), samedi jusqu'à 20 h, dimanche fermé
        $week = [
            1 => ['09:00', '19:00', '13:00', '14:00'], 2 => ['09:00', '19:00', '13:00', '14:00'],
            3 => ['09:00', '19:00', '13:00', '14:00'], 4 => ['09:00', '19:00', '13:00', '14:00'],
            5 => ['09:00', '19:00', '13:00', '15:00'], 6 => ['09:00', '20:00', null, null],
        ];
        for ($day = 1; $day <= 7; $day++) {
            [$open, $close, $breakStart, $breakEnd] = $week[$day] ?? [null, null, null, null];
            BusinessHour::updateOrCreate(['day_of_week' => $day], [
                'is_closed' => ! isset($week[$day]), 'opens_at' => $open, 'closes_at' => $close,
                'break_start' => $breakStart, 'break_end' => $breakEnd,
            ]);
        }
    }
}
