<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/** Paramètres modifiables depuis l'ERP (délai de réservation, TVA, coordonnées…) */
class Setting extends Model
{
    protected $fillable = ['group', 'key', 'value'];

    protected function casts(): array { return ['value' => 'json']; }

    /** Setting::get('booking.min_notice_minutes', 120) — mis en cache 10 minutes */
    public static function get(string $key, mixed $default = null): mixed
    {
        // first()?->value et non ->value('value') : value() lit la colonne brute, SANS la conversion JSON du modèle
        return Cache::remember("setting:{$key}", 600, fn () => static::query()->where('key', $key)->first()?->value) ?? $default;
    }
}
