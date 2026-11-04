<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Fermeture exceptionnelle (jour férié, Tabaski, Korité…) */
class Closure extends Model
{
    protected $fillable = ['starts_on', 'ends_on', 'reason'];

    protected function casts(): array
    {
        return ['starts_on' => 'date', 'ends_on' => 'date'];
    }
}
