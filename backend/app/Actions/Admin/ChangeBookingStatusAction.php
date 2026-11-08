<?php

namespace App\Actions\Admin;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Notifications\BookingCancelledBySalon;
use App\Notifications\BookingConfirmed;
use App\Support\Notify;
use Illuminate\Validation\ValidationException;

/**
 * Confirmer, terminer, marquer absent ou annuler une réservation (EF-RES-06, EF-RES-07).
 * Étape 13 : le motif d'annulation est OBLIGATOIRE et la cliente est prévenue (SMS + e-mail).
 */
class ChangeBookingStatusAction
{
    public function execute(Booking $booking, BookingStatus $next, ?string $reason = null): Booking
    {
        if (! $booking->status->canTransitionTo($next)) {
            throw ValidationException::withMessages(['status' => "Passage impossible de « {$booking->status->label()} » à « {$next->label()} »."]);
        }
        if (in_array($next, [BookingStatus::Completed, BookingStatus::NoShow], true) && $booking->starts_at->isFuture()) {
            throw ValidationException::withMessages(['status' => 'Ce rendez-vous n’a pas encore eu lieu.']);
        }
        $reason = trim((string) $reason);
        if ($next === BookingStatus::Cancelled && mb_strlen($reason) < 5) {
            throw ValidationException::withMessages(['reason' => 'Indiquez le motif de l’annulation : il est envoyé à la cliente.']);
        }

        $booking->update(['status' => $next, ...match ($next) {
            BookingStatus::Confirmed => ['confirmed_at' => now()],
            BookingStatus::Completed => ['completed_at' => now()],
            BookingStatus::Cancelled => ['cancelled_at' => now(), 'cancelled_by' => 'staff', 'cancellation_reason' => $reason],
            default => [],
        }]);

        match ($next) {
            BookingStatus::Confirmed => Notify::customer($booking->loadMissing('customer')->customer, new BookingConfirmed($booking)),
            BookingStatus::Cancelled => Notify::customer($booking->loadMissing('customer')->customer, new BookingCancelledBySalon($booking)),
            default => null,
        };

        return $booking;
    }
}
