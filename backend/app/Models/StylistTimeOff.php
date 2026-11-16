<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class StylistTimeOff extends Model
{
    protected $table = 'stylist_time_off';

    protected $fillable = ['stylist_id', 'starts_at', 'ends_at', 'reason'];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    /** @return BelongsTo<Stylist, $this> */
    public function stylist(): BelongsTo
    {
        return $this->belongsTo(Stylist::class);
    }
}
