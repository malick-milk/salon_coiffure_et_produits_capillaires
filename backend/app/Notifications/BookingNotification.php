<?php

namespace App\Notifications;

use App\Models\Booking;
use App\Models\Service;
use App\Support\Resserrage;
use Carbon\CarbonImmutable;

/** Notification liée à un rendez-vous : on copie les informations utiles (pas de requête à l'envoi) */
abstract class BookingNotification extends CustomerNotification
{
    public string $reference;

    public string $service;

    public CarbonImmutable $startsAt;

    /** @var array{advised_on: string, delay_label: string, slug: string, name: string, price: int, duration_minutes: int}|null */
    public ?array $resserrage;

    public function __construct(Booking $booking)
    {
        parent::__construct();
        $this->reference = $booking->reference;
        $this->service = $booking->service_name;
        $this->startsAt = CarbonImmutable::parse($booking->starts_at);
        // Requête explicite (pas de chargement paresseux : la réservation peut venir d'une liste)
        $this->resserrage = Resserrage::forService(Service::with('resserrageService')->find($booking->service_id), $this->startsAt);
    }

    /** « Resserrage conseillé vers le 29 janvier 2027 (2 mois après votre twist). », ou null */
    protected function resserrageLine(): ?string
    {
        if (! $this->resserrage) {
            return null;
        }
        $date = CarbonImmutable::parse($this->resserrage['advised_on'])->locale('fr')->isoFormat('D MMMM YYYY');

        return "Resserrage conseillé vers le **{$date}** ({$this->resserrage['delay_label']} après votre twist), pour garder des racines nettes.";
    }

    protected function whenText(): string
    {
        return self::when($this->startsAt);
    }
}
