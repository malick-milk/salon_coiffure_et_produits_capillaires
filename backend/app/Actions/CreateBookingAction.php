<?php

namespace App\Actions;

use App\Enums\BookingSource;
use App\Enums\BookingStatus;
use App\Exceptions\SlotUnavailableException;
use App\Models\Booking;
use App\Models\Service;
use App\Models\Stylist;
use App\Models\User;
use App\Services\Booking\AvailabilityService;
use App\Services\Customers\CustomerResolver;
use App\Services\Support\ReferenceGenerator;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * RÉSERVER UN CRÉNEAU (RG-RES-01, RG-RES-02). Spécification : frontend/src/mocks/handlers.ts (POST /bookings).
 *
 * Protection contre la double réservation, en deux niveaux :
 * 1. Transaction + VERROU sur les coiffeurs concernés, puis revérification de la disponibilité :
 *    deux demandes simultanées pour le même coiffeur passent l'une APRÈS l'autre.
 * 2. Filet de sécurité en base : l'index unique (stylist_id, active_slot) refuse un doublon.
 */
class CreateBookingAction
{
    public function __construct(
        private AvailabilityService $availability,
        private CustomerResolver $customers,
        private ReferenceGenerator $references,
    ) {}

    /** @param array{service_id:int,stylist_id:?int,date:string,time:string,customer:array,notes:?string} $data */
    public function execute(array $data, ?User $user): Booking
    {
        $service = Service::query()->active()->findOrFail($data['service_id']);
        $allowed = $service->stylists()->active()->pluck('stylists.id')->all();
        $stylistIds = $data['stylist_id'] ? array_values(array_intersect($allowed, [(int) $data['stylist_id']])) : $allowed;
        if ($stylistIds === []) {
            throw new SlotUnavailableException('Ce coiffeur ne réalise pas cette prestation.');
        }

        try {
            return DB::transaction(function () use ($data, $user, $service, $stylistIds) {
                Stylist::query()->whereIn('id', $stylistIds)->orderBy('id')->lockForUpdate()->get(); // verrou (ordre fixe : pas d'interblocage)

                $day = $this->availability->forDay($data['date'], $service, $stylistIds);
                $slot = collect($day['slots'])->firstWhere('time', $data['time']);
                if (! $slot || ! $slot['available']) {
                    throw new SlotUnavailableException;
                }

                $start = CarbonImmutable::parse("{$data['date']} {$data['time']}", 'UTC');

                return Booking::create([
                    'reference' => $this->references->next('booking', 'RDV'),
                    'customer_id' => $this->customers->resolve($user, $data['customer'])->id,
                    'service_id' => $service->id,
                    'stylist_id' => $slot['free_stylist_ids'][0], // « peu importe » : premier coiffeur libre
                    'source' => BookingSource::Online,
                    'status' => BookingStatus::Pending,
                    'starts_at' => $start,
                    'ends_at' => $start->addMinutes($service->duration_minutes + $service->buffer_minutes),
                    'service_name' => $service->name, // instantanés
                    'duration_minutes' => $service->duration_minutes,
                    'price' => $service->price,
                    'customer_notes' => $data['notes'] ?? null,
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            throw new SlotUnavailableException; // le filet de sécurité de la base a joué son rôle
        }
    }
}
