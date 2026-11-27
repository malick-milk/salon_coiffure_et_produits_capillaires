<?php

namespace App\Support;

use App\Models\Service;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * DATE CONSEILLÉE DU RESSERRAGE (maquette validée le 27 novembre 2026) : Awa conseille un resserrage 2 mois
 * après chaque twist. La cliente connaît cette date dès la réservation (écran, e-mails, « Mes réservations »).
 * Le délai de chaque twist est dans services.resserrage_after_days (ReferenceDataSeeder::RESSERRAGE).
 */
final class Resserrage
{
    /**
     * La date conseillée et le resserrage proposé, ou null si la prestation n'en a pas
     *
     * @return array{advised_on: string, delay_label: string, slug: string, name: string, price: int, duration_minutes: int}|null
     */
    public static function forService(?Service $service, CarbonInterface $doneAt): ?array
    {
        $target = $service?->resserrage_after_days !== null ? $service->resserrageService : null;
        if (! $service || ! $target) {
            return null;
        }
        $days = (int) $service->resserrage_after_days;

        return [
            'advised_on' => CarbonImmutable::parse($doneAt)->startOfDay()->addDays($days)->toDateString(),
            'delay_label' => self::delayLabel($days),
            'slug' => $target->slug, 'name' => $target->name, 'price' => $target->price, 'duration_minutes' => $target->duration_minutes,
        ];
    }

    /** 60 → « 2 mois », 30 → « 1 mois », 28 → « 4 semaines », 10 → « 10 jours » */
    public static function delayLabel(int $days): string
    {
        return match (true) {
            $days >= 30 && $days % 30 === 0 => ($days / 30).' mois',
            $days >= 7 && $days % 7 === 0 => ($days / 7).' semaine'.($days > 7 ? 's' : ''),
            default => $days.' jour'.($days > 1 ? 's' : ''),
        };
    }
}
