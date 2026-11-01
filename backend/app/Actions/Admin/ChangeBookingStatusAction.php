<?php

namespace App\Actions\Admin;

use App\Enums\BookingStatus;
use App\Models\Booking;
use Illuminate\Validation\ValidationException;

/** Confirmer, terminer, marquer absent ou annuler une réservation (EF-RES-06, EF-RES-07) */
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

        $booking->update(['status' => $next, ...match ($next) {
            BookingStatus::Confirmed => ['confirmed_at' => now()],
            BookingStatus::Completed => ['completed_at' => now()],
            BookingStatus::Cancelled => ['cancelled_at' => now(), 'cancelled_by' => 'staff', 'cancellation_reason' => $reason],
            default => [],
        }]);

        return $booking;
    }
}
