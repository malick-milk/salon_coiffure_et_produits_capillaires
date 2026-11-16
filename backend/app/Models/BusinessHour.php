<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Horaires hebdomadaires (1 = lundi … 7 = dimanche)
 *
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property int $day_of_week
 * @property bool $is_closed
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class BusinessHour extends Model
{
    protected $fillable = ['day_of_week', 'is_closed', 'opens_at', 'closes_at', 'break_start', 'break_end'];

    protected function casts(): array
    {
        return ['day_of_week' => 'integer', 'is_closed' => 'boolean'];
    }
}
