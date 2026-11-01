<?php

namespace App\Enums;

/** Origine d'une réservation */
enum BookingSource: string
{
    use HasValues;

    case Online = 'online';
    case Phone = 'phone';
    case WalkIn = 'walk_in';
}
