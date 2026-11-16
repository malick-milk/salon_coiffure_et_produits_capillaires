<?php

namespace App\Services\Salon;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Notifications\ResserrageReminder;
use App\Support\Notify;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Qui reçoit un rappel de resserrage aujourd'hui ?
 *
 * Un twist TERMINÉ dont la prestation a un délai conseillé (fixé par Awa), quand :
 *   - la date du twist + le délai est atteinte (ou, après un report, 7 jours sont passés) ;
 *   - aucun rappel n'est encore parti pour ce twist ;
 *   - la cliente n'a pas déjà réservé un resserrage depuis (rendez-vous non annulé) ;
 *   - la cliente n'a pas demandé à ne plus recevoir ces rappels.
 * Un twist traité est marqué (resserrage_reminded_at) : il ne sera plus jamais examiné, même sans envoi.
 */
class ResserrageReminderService
{
    public const SNOOZE_DAYS = 7;

    /** @return array{sent:int, skipped:int} */
    public function run(?CarbonImmutable $today = null): array
    {
        $today ??= CarbonImmutable::today();
        $sent = $skipped = 0;

        $this->due($today)->with(['customer', 'service.resserrageService'])->chunkById(200, function ($bookings) use (&$sent, &$skipped) {
            foreach ($bookings as $booking) {
                $customer = $booking->customer;
                $resserrage = $booking->service?->resserrageService;
                $alreadyBooked = $resserrage && Booking::query()
                    ->where('customer_id', $booking->customer_id)
                    ->where('service_id', $resserrage->id)
                    ->where('starts_at', '>', $booking->starts_at)
                    ->whereNotIn('status', [BookingStatus::Cancelled, BookingStatus::NoShow])
                    ->exists();
                $reachable = $customer && ($customer->user_id !== null || $customer->email);

                // Marqué AVANT l'envoi : si l'envoi échoue, la cliente ne reçoit pas deux rappels demain
                $booking->forceFill(['resserrage_reminded_at' => now()])->save();
                if (! $resserrage || $alreadyBooked || ! $reachable || $customer->resserrage_opt_out) {
                    $skipped++;

                    continue;
                }
                Notify::customer($customer, new ResserrageReminder($booking, $resserrage, (int) $booking->service->resserrage_after_days));
                $sent++;
            }
        });

        return ['sent' => $sent, 'skipped' => $skipped];
    }

    /** @return Builder<Booking> */
    private function due(CarbonImmutable $today): Builder
    {
        return Booking::query()
            ->where('status', BookingStatus::Completed)
            ->whereNull('resserrage_reminded_at')
            ->whereHas('service', fn ($q) => $q->whereNotNull('resserrage_after_days')->whereNotNull('resserrage_service_id'))
            ->where(function ($q) use ($today) {
                // Sans report : date du twist + délai atteinte (calculé par MySQL avec le délai de la prestation)
                $q->whereNull('resserrage_snoozed_at')
                    ->whereRaw('DATE_ADD(DATE(bookings.starts_at), INTERVAL (SELECT s.resserrage_after_days FROM services s WHERE s.id = bookings.service_id) DAY) <= ?', [$today->toDateString()])
                    // Après un report : une semaine plus tard
                    ->orWhere(fn ($s) => $s->whereNotNull('resserrage_snoozed_at')->where('resserrage_snoozed_at', '<=', $today->subDays(self::SNOOZE_DAYS)->endOfDay()));
            });
    }
}
