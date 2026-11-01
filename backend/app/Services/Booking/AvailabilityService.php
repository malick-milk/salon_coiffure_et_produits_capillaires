<?php

namespace App\Services\Booking;

use App\Models\Booking;
use App\Models\BusinessHour;
use App\Models\Closure;
use App\Models\Service;
use App\Models\Setting;
use App\Models\StylistTimeOff;
use Carbon\CarbonImmutable;

/**
 * CALCUL DES CRÉNEAUX DISPONIBLES (RG-RES-01 à RG-RES-03).
 *
 * Traduction PHP de frontend/src/mocks/availability.ts : mêmes règles, mêmes cas de test
 * (tests/Feature/AvailabilityTest.php). En plus du faux serveur : les congés des coiffeurs.
 * Fuseau : Africa/Dakar = UTC+0 toute l'année ; l'application stocke et calcule en UTC.
 */
class AvailabilityService
{
    /**
     * @param  list<int>  $stylistIds  coiffeurs possibles (un seul si le client a choisi)
     * @return array{date:string,is_open:bool,closed_reason:?string,slots:list<array{time:string,available:bool,free_stylist_ids:list<int>}>}
     */
    public function forDay(string $date, Service $service, array $stylistIds): array
    {
        $closed = fn (string $reason) => ['date' => $date, 'is_open' => false, 'closed_reason' => $reason, 'slots' => []];
        $day = CarbonImmutable::parse($date, 'UTC')->startOfDay();
        $now = CarbonImmutable::now('UTC');

        // 1. Fermeture exceptionnelle
        $closure = Closure::query()->whereDate('starts_on', '<=', $date)->whereDate('ends_on', '>=', $date)->first();
        if ($closure) {
            return $closed($closure->reason ?? 'Salon fermé ce jour-là');
        }

        // 2. Horaires du jour (1 = lundi … 7 = dimanche)
        $hours = BusinessHour::query()->where('day_of_week', $day->dayOfWeekIso)->first();
        if (! $hours || $hours->is_closed || ! $hours->opens_at || ! $hours->closes_at) {
            return $closed('Salon fermé ce jour-là');
        }

        // 3. Horizon de réservation
        $horizonDays = (int) Setting::get('booking.max_horizon_days', 60);
        if ($day->greaterThan($now->addDays($horizonDays))) {
            return $closed("Réservation possible jusqu'à {$horizonDays} jours à l'avance");
        }

        $open = self::minutes($hours->opens_at);
        $close = self::minutes($hours->closes_at);
        $breakStart = $hours->break_start ? self::minutes($hours->break_start) : null;
        $breakEnd = $hours->break_end ? self::minutes($hours->break_end) : null;
        $step = (int) Setting::get('booking.slot_step_minutes', 30);
        $earliest = $now->addMinutes((int) Setting::get('booking.min_notice_minutes', 120));

        // Intervalles OCCUPÉS de chaque coiffeur ce jour-là (réservations actives + congés), en minutes
        $busy = array_fill_keys($stylistIds, []);
        Booking::query()->active()->whereIn('stylist_id', $stylistIds)->whereDate('starts_at', $date)
            ->get(['stylist_id', 'starts_at', 'ends_at'])
            ->each(function (Booking $b) use (&$busy) {
                $busy[$b->stylist_id][] = [self::minutes($b->starts_at->format('H:i')), self::minutes($b->ends_at->format('H:i'))];
            });
        StylistTimeOff::query()->whereIn('stylist_id', $stylistIds)
            ->where('starts_at', '<', $day->addDay())->where('ends_at', '>', $day)
            ->get()->each(function (StylistTimeOff $t) use (&$busy, $day) {
                $from = max(0, (int) $day->diffInMinutes($t->starts_at, false));
                $to = min(24 * 60, (int) $day->diffInMinutes($t->ends_at, false));
                $busy[$t->stylist_id][] = [$from, $to];
            });

        $duration = $service->duration_minutes;
        $slots = [];
        for ($start = $open; $start + $duration <= $close; $start += $step) {
            $end = $start + $duration;

            // 4. La prestation ne doit pas empiéter sur la pause : créneau non proposé
            if ($breakStart !== null && $breakEnd !== null && self::overlaps($start, $end, $breakStart, $breakEnd)) {
                continue;
            }

            // 5. Délai minimal : affiché mais indisponible
            $tooSoon = $day->addMinutes($start)->lessThan($earliest);

            // 6. Coiffeurs libres sur [début, fin + battement[
            $free = $tooSoon ? [] : array_values(array_filter($stylistIds, function (int $id) use ($busy, $start, $end, $service) {
                foreach ($busy[$id] as [$bStart, $bEnd]) {
                    if (self::overlaps($start, $end + $service->buffer_minutes, $bStart, $bEnd)) {
                        return false;
                    }
                }

                return true;
            }));

            $slots[] = ['time' => self::hhmm($start), 'available' => $free !== [], 'free_stylist_ids' => $free];
        }

        return ['date' => $date, 'is_open' => true, 'closed_reason' => null, 'slots' => $slots];
    }

    /** Deux intervalles [a, b[ et [c, d[ se chevauchent si a < d ET c < b */
    public static function overlaps(int $aStart, int $aEnd, int $bStart, int $bEnd): bool
    {
        return $aStart < $bEnd && $bStart < $aEnd;
    }

    /** "10:30" ou "10:30:00" -> 630 */
    public static function minutes(string $time): int
    {
        [$h, $m] = array_map('intval', explode(':', $time));

        return $h * 60 + $m;
    }

    public static function hhmm(int $minutes): string
    {
        return sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
    }
}
