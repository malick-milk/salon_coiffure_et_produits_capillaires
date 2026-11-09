<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\SatisfactionSurvey;
use App\Models\Stylist;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Avis de DÉMONSTRATION (étape 13) — uniquement en local, jamais en test ni en production.
 * De quoi voir la section « Avis clients » de l'accueil et la page ERP « Avis clients » :
 * des avis publiés, un avis à modérer, une note basse à rappeler.
 */
class DemoReviewsSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            return;
        }
        $stylist = Stylist::where('display_name', ReferenceDataSeeder::STYLIST_NAME)->value('id');
        $reviews = [
            ['Aïssatou', 'Diallo', '770000011', 5, 10, 'Travail très soigné, mes twists ont tenu six semaines. Accueil chaleureux, je reviens le mois prochain.', 'approved', 'Merci Aïssatou, à très bientôt !', 3],
            ['Fatou', 'Sarr', '770000012', 5, 9, 'Le sérum Activ’Pousse a vraiment changé mes bords en un mois. Livraison rapide à Pikine.', 'approved', null, 6, 'order'],
            ['Mame', 'Badji', '770000013', 4, 8, 'Très bon soin, mais un peu d’attente malgré le rendez-vous.', 'approved', 'Merci pour votre retour : nous avons revu l’organisation des créneaux du samedi.', 10],
            ['Khady', 'Ndour', '770000014', 5, 10, 'Super ambiance et coiffure nickel, merci à toute l’équipe !', 'pending', null, 1],
            ['Ndeye', 'Faye', '770000015', 2, 4, 'Les produits sont bien, mais ma commande est arrivée avec deux jours de retard.', 'none', null, 2, 'order'],
        ];
        foreach ($reviews as $i => $r) {
            [$first, $last, $phone, $rating, $nps, $comment, $status, $reply, $daysAgo] = $r;
            $kind = $r[9] ?? 'booking';
            $customer = Customer::updateOrCreate(['phone' => $phone], ['first_name' => $first, 'last_name' => $last]);
            SatisfactionSurvey::updateOrCreate(['customer_id' => $customer->id], [
                'token_hash' => SatisfactionSurvey::hashToken(Str::random(40)),
                'kind' => $kind,
                'subject_label' => $kind === 'booking' ? ['Micro twist long', 'Mini twist', 'Twist simple'][$i % 3] : 'Commande CMD-2026-0000'.(20 + $i),
                'stylist_id' => $kind === 'booking' ? $stylist : null,
                'sent_at' => now()->subDays($daysAgo + 1), 'expires_at' => now()->addDays(13 - $daysAgo),
                'answered_at' => now()->subDays($daysAgo), 'rating' => $rating, 'nps' => $nps, 'comment' => $comment,
                'publish_consent' => $status !== 'none', 'review_status' => $status, 'reply' => $reply,
                'moderated_at' => $status === 'approved' ? now()->subDays($daysAgo) : null,
            ]);
        }
    }
}
