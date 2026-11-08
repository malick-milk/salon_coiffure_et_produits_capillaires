<?php

namespace App\Notifications;

use App\Models\Booking;
use Carbon\CarbonImmutable;

/** Notification liée à un rendez-vous : on copie les informations utiles (pas de requête à l'envoi) */
abstract class BookingNotification extends CustomerNotification
{
    public string $reference;

    public string $service;

    public CarbonImmutable $startsAt;

    public function __construct(Booking $booking)
    {
        parent::__construct();
        $this->reference = $booking->reference;
        $this->service = $booking->service_name;
        $this->startsAt = CarbonImmutable::parse($booking->starts_at);
    }

    protected function whenText(): string
    {
        return self::when($this->startsAt);
    }
}
