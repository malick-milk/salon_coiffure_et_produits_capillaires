<?php

namespace App\Http\Resources;

use App\Models\Booking;
use App\Models\Setting;
use App\Support\Resserrage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Booking */
class CustomerBookingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'reference' => $this->reference,
            'status' => $this->status->value,
            'service_name' => $this->service_name,
            'stylist_name' => $this->stylist->display_name,
            'starts_at' => $this->starts_at->format('Y-m-d\TH:i:s'),
            'duration_minutes' => $this->duration_minutes,
            'price' => $this->price,
            'can_cancel' => self::canCancel($this->resource), // calculé à la lecture : dépend de l'heure
            // Étape 13 : la cliente voit qui a annulé et pourquoi (le motif du salon lui est aussi envoyé)
            'cancelled_by' => $this->cancelled_by,
            'cancellation_reason' => $this->cancelled_by === 'staff' ? $this->cancellation_reason : null,
            // Date conseillée du resserrage (27 novembre 2026), sauf pour un rendez-vous annulé ou manqué
            'resserrage' => in_array($this->status->value, ['pending', 'confirmed', 'completed'], true) && $this->relationLoaded('service')
                ? Resserrage::forService($this->service, $this->starts_at) : null,
        ];
    }

    /** RG-RES-04 : annulation en ligne jusqu'à 24 h avant (paramétrable) */
    public static function canCancel(Booking $booking): bool
    {
        $hours = (int) Setting::get('booking.customer_cancel_hours', 24);

        return in_array($booking->status->value, ['pending', 'confirmed'], true)
            && $booking->starts_at->greaterThan(now()->addHours($hours));
    }
}
