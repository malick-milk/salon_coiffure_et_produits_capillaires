<?php

namespace App\Exceptions;

use RuntimeException;

/** Le créneau demandé n'est plus libre (pris entre-temps, trop proche, fermé…) : HTTP 409 */
class SlotUnavailableException extends RuntimeException
{
    public function __construct(string $message = 'Ce créneau vient d’être réservé. Merci d’en choisir un autre.')
    {
        parent::__construct($message);
    }
}
