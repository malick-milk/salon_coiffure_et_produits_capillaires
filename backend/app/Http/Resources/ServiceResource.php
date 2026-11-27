<?php

namespace App\Http\Resources;

use App\Models\Service;
use App\Support\Resserrage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Prestation publique : buffer_minutes (logistique interne) n'est pas exposé
 *
 * @mixin Service
 */
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
            // Délai et resserrage proposé : la date conseillée s'affiche dès la confirmation de la réservation
            'resserrage' => $this->resserrage_after_days !== null && $this->relationLoaded('resserrageService') && $this->resserrageService ? [
                'after_days' => (int) $this->resserrage_after_days, 'delay_label' => Resserrage::delayLabel((int) $this->resserrage_after_days),
                'slug' => $this->resserrageService->slug, 'name' => $this->resserrageService->name,
                'price' => $this->resserrageService->price, 'duration_minutes' => $this->resserrageService->duration_minutes,
            ] : null,
        ];
    }
}
