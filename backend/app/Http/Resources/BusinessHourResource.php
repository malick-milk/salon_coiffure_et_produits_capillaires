<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BusinessHourResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $hhmm = fn (?string $t) => $t ? substr($t, 0, 5) : null; // "09:00:00" -> "09:00" (contrat)

        return [
            'day_of_week' => $this->day_of_week,
            'is_closed' => $this->is_closed,
            'opens_at' => $hhmm($this->opens_at),
            'closes_at' => $hhmm($this->closes_at),
            'break_start' => $hhmm($this->break_start),
            'break_end' => $hhmm($this->break_end),
        ];
    }
}
