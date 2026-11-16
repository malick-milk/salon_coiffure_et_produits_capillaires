<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Prestation publique : buffer_minutes (logistique interne) n'est pas exposé */
class ServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'category' => $this->category->name,
            'description' => $this->description,
            'duration_minutes' => $this->duration_minutes,
            'price' => $this->price,
            // Rappel de resserrage proposé pour cette prestation (délai fixé par Awa) : affiche l'invitation à créer un compte
            'resserrage_reminder' => $this->resserrage_after_days !== null && $this->resserrage_service_id !== null,
        ];
    }
}
