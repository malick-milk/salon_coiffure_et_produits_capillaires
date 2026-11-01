<?php

namespace App\Http\Resources;

use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

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
        ];
    }

    /** RG-RES-04 : annulation en ligne jusqu'à 24 h avant (paramétrable) */
    public static function canCancel(\App\Models\Booking $booking): bool
    {
        $hours = (int) Setting::get('booking.customer_cancel_hours', 24);

        return in_array($booking->status->value, ['pending', 'confirmed'], true)
            && $booking->starts_at->greaterThan(now()->addHours($hours));
    }
}
