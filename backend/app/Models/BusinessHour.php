<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Horaires hebdomadaires (1 = lundi … 7 = dimanche) */
class BusinessHour extends Model
{
    protected $fillable = ['day_of_week', 'is_closed', 'opens_at', 'closes_at', 'break_start', 'break_end'];

    protected function casts(): array
    {
        return ['day_of_week' => 'integer', 'is_closed' => 'boolean'];
    }
}
