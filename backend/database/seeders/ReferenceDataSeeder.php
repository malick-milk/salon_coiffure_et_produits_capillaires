<?php

namespace Database\Seeders;

use App\Models\BusinessHour;
use App\Models\Closure;
use App\Models\DeliveryZone;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Setting;
use App\Models\Stylist;
use Illuminate\Database\Seeder;

/** Données de référence : zones de livraison, prestations, coiffeurs, horaires, paramètres */
class ReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([['Dakar Plateau', 1000], ['Parcelles Assainies', 1500], ['Rufisque', 2500]] as [$name, $fee]) {
            DeliveryZone::updateOrCreate(['name' => $name], ['fee' => $fee]);
        }

        $tresses = ServiceCategory::updateOrCreate(['slug' => 'tresses'], ['name' => 'Tresses', 'position' => 1]);
        $soins = ServiceCategory::updateOrCreate(['slug' => 'soins'], ['name' => 'Soins', 'position' => 2]);
        $services = [
            ['tresses-africaines', 'Tresses africaines', $tresses, 180, 15, 25000],
            ['nattes-collees', 'Nattes collées', $tresses, 90, 15, 12000],
            ['soin-profond-karite', 'Soin profond au karité', $soins, 60, 10, 8000],
        ];
        foreach ($services as $i => [$slug, $name, $category, $duration, $buffer, $price]) {
            Service::updateOrCreate(['slug' => $slug], [
                'name' => $name, 'service_category_id' => $category->id, 'duration_minutes' => $duration,
                'buffer_minutes' => $buffer, 'price' => $price, 'position' => $i,
            ]);
        }

        // Coiffeurs de DÉMONSTRATION. Bineta ne réalise pas les nattes collées (table service_stylist).
        $fatou = Stylist::updateOrCreate(['display_name' => 'Fatou'], []);
        $bineta = Stylist::updateOrCreate(['display_name' => 'Bineta'], []);
        $fatou->services()->sync(Service::pluck('id'));
        $bineta->services()->sync(Service::whereIn('slug', ['tresses-africaines', 'soin-profond-karite'])->pluck('id'));

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

        foreach ([['2026-12-25', 'Fermé : Noël'], ['2027-01-01', 'Fermé : Jour de l’an']] as [$date, $reason]) {
            Closure::updateOrCreate(['starts_on' => $date, 'ends_on' => $date], ['reason' => $reason]);
        }

        $settings = [
            ['booking', 'booking.min_notice_minutes', 120],
            ['booking', 'booking.max_horizon_days', 60],
            ['booking', 'booking.customer_cancel_hours', 24],
            ['booking', 'booking.slot_step_minutes', 30],
            ['tax', 'tax.enabled', false],
            ['tax', 'tax.rate', 18.0],
            ['shop', 'shop.guest_checkout', true],
            ['company', 'company.identity', ['name' => 'Dabo Hair', 'ninea' => '[À RENSEIGNER]', 'rccm' => '[À RENSEIGNER]', 'address' => 'Dakar, Sénégal']],
        ];
        foreach ($settings as [$group, $key, $value]) {
            Setting::updateOrCreate(['key' => $key], ['group' => $group, 'value' => $value]);
        }
    }
}
