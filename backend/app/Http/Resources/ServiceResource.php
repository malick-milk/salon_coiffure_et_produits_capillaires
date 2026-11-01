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
        ];
    }
}
