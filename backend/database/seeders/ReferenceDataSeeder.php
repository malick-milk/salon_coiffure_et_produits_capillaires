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
    /** La coiffeuse du salon (une seule pour l'instant) */
    public const STYLIST_NAME = 'Awa Dabo';

    public function run(): void
    {
        foreach ([['Dakar Plateau', 1000], ['Parcelles Assainies', 1500], ['Rufisque', 2500]] as [$name, $fee]) {
            DeliveryZone::updateOrCreate(['name' => $name], ['fee' => $fee]);
        }

        // ---- Le salon RÉEL (renseigné le 9 novembre 2026) ----
        // Prix et durées donnés par Dabo Hair. buffer_minutes = 0 : pas de battement entre deux clientes.
        // Le salon ne pose PAS de mèches : les twists se font uniquement sur les cheveux de la cliente.
        $own = ' Uniquement sur vos propres cheveux, sans mèches.';
        // Micro twist : le prix dépend de la longueur des cheveux (court 8-10, mi-long 12-15, long 18-20 ; en centimètres)
        $twists = ServiceCategory::updateOrCreate(['slug' => 'twists'], ['name' => 'Twists', 'position' => 1]);
        $soinTwist = ServiceCategory::updateOrCreate(['slug' => 'soin-et-twist'], ['name' => 'Soin et twist', 'position' => 2]);
        $brushing = ServiceCategory::updateOrCreate(['slug' => 'brushing'], ['name' => 'Brushing', 'position' => 3]);
        $services = [
            // [slug, nom, catégorie, durée (min), prix, active ?, description]
            ['twist-simple', 'Twist simple', $twists, 120, 5000, true, 'Twists sur cheveux naturels.'.$own],
            ['mini-twist', 'Mini twist', $twists, 240, 10000, true, 'Twists fins, longue tenue.'.$own],
            ['micro-twist-court', 'Micro twist court', $twists, 480, 20000, true, 'Twists très fins, cheveux de 8 à 10 cm.'.$own],
            ['micro-twist-mi-long', 'Micro twist mi-long', $twists, 480, 25000, true, 'Twists très fins, cheveux de 12 à 15 cm.'.$own],
            ['micro-twist-long', 'Micro twist long', $twists, 480, 30000, true, 'Twists très fins, cheveux de 18 à 20 cm.'.$own],
            ['resserrage-twist', 'Resserrage twist simple', $twists, 90, 5000, true, 'Entretien des racines.'.$own],
            ['soin-shampooing-twist', 'Soin, shampooing et twist', $soinTwist, 90, 8000, true, 'Le soin complet avant la coiffure.'.$own],
            ['brushing', 'Brushing', $brushing, 60, 3000, true, 'Lissage au séchoir.'],
            // Encore une information manquante : la prestation reste MASQUÉE (is_active = false), sinon la réservation
            // proposerait de faux créneaux ou un faux prix. Les valeurs ci-dessous sont des valeurs d'attente, jamais affichées.
            ['resserrage-micro-twist', 'Resserrage micro twist', $twists, 120, 5000, false, 'Entretien des racines des micro twists.'.$own], // prix à confirmer
            ['soin-shampooing-bain-huile-twist', 'Soin, shampooing, bain d’huile et twist', $soinTwist, 90, 10000, false, 'Pour les cheveux très secs.'.$own], // durée à confirmer
            ['soin-brushing', 'Soin et brushing', $brushing, 60, 5000, false, 'Soin profond puis brushing.'], // durée à confirmer
        ];
        foreach ($services as $i => [$slug, $name, $category, $duration, $price, $active, $description]) {
            Service::updateOrCreate(['slug' => $slug], [
                'name' => $name, 'service_category_id' => $category->id, 'duration_minutes' => $duration,
                'buffer_minutes' => 0, 'price' => $price, 'is_active' => $active, 'position' => $i, 'description' => $description,
            ]);
        }

        // Une seule coiffeuse pour l'instant ; d'autres pourront être ajoutées au recrutement.
        $stylist = Stylist::updateOrCreate(['display_name' => self::STYLIST_NAME], ['is_active' => true]);
        $stylist->services()->sync(Service::whereIn('slug', array_column($services, 0))->pluck('id'));

        // Ouvert tous les jours, de 9 h à 19 h, sans pause déclarée
        for ($day = 1; $day <= 7; $day++) {
            BusinessHour::updateOrCreate(['day_of_week' => $day], [
                'is_closed' => false, 'opens_at' => '09:00', 'closes_at' => '19:00', 'break_start' => null, 'break_end' => null,
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
            ['company', 'company.identity', ['name' => 'Dabo Hair', 'ninea' => '[À RENSEIGNER]', 'rccm' => '[À RENSEIGNER]', 'address' => 'Cité Almadies 2, ZAC Mbao (Extension Jaxaay), Dakar, Sénégal', 'phone' => '77 602 62 00']],
        ];
        foreach ($settings as [$group, $key, $value]) {
            Setting::updateOrCreate(['key' => $key], ['group' => $group, 'value' => $value]);
        }
    }
}
