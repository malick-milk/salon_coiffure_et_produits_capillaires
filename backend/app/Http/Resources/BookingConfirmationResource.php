<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingConfirmationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'reference' => $this->reference,
            'status' => $this->status->value,
            'service_name' => $this->service_name,
            'stylist_name' => $this->stylist->display_name,
            'starts_at' => $this->starts_at->format('Y-m-d\TH:i:s'),
            // fin de PRESTATION (le battement de nettoyage est un détail interne)
            'ends_at' => $this->starts_at->copy()->addMinutes($this->duration_minutes)->format('Y-m-d\TH:i:s'),
            'price' => $this->price,
        ];
    }
}
