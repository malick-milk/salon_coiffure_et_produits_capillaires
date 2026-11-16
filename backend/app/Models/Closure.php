<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Fermeture exceptionnelle (jour férié, Tabaski, Korité…)
 *
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property Carbon $starts_on
 * @property Carbon $ends_on
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Closure extends Model
{
    protected $fillable = ['starts_on', 'ends_on', 'reason'];

    protected function casts(): array
    {
        return ['starts_on' => 'date', 'ends_on' => 'date'];
    }
}
