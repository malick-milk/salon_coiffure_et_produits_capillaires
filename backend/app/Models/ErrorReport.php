<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Une erreur DIFFÉRENTE vue sur le site (serveur ou navigateur), avec son nombre d'apparitions.
 *
 * @property string $source server | browser
 * @property string $fingerprint
 * @property string $type
 * @property string $message
 * @property string|null $location
 * @property array<string, mixed>|null $context
 * @property int $occurrences
 * @property Carbon $first_seen_at
 * @property Carbon $last_seen_at
 * @property Carbon|null $notified_at
 */
class ErrorReport extends Model
{
    protected $fillable = ['source', 'fingerprint', 'type', 'message', 'location', 'context', 'occurrences', 'first_seen_at', 'last_seen_at', 'notified_at'];

    protected function casts(): array
    {
        return ['context' => 'array', 'occurrences' => 'integer', 'first_seen_at' => 'datetime', 'last_seen_at' => 'datetime', 'notified_at' => 'datetime'];
    }
}
