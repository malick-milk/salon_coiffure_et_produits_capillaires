<?php

namespace App\Enums;

/** Cycle de vie d'une réservation (RG-RES-05), en machine à états */
enum BookingStatus: string
{
    use HasValues;

    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case NoShow = 'no_show';

    /** @return list<self> */
    public function transitions(): array
    {
        return match ($this) {
            self::Pending => [self::Confirmed, self::Cancelled],
            self::Confirmed => [self::Completed, self::NoShow, self::Cancelled],
            self::Completed, self::Cancelled, self::NoShow => [],
        };
    }

    public function canTransitionTo(self $next): bool
    {
        return in_array($next, $this->transitions(), true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'En attente', self::Confirmed => 'Confirmée', self::Completed => 'Terminée',
            self::Cancelled => 'Annulée', self::NoShow => 'Absent',
        };
    }
}
