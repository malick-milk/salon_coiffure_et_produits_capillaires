<?php

namespace App\Enums;

/** Cycle de vie d'une réservation (RG-RES-05) */
enum BookingStatus: string
{
    use HasValues;

    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case NoShow = 'no_show';
}
