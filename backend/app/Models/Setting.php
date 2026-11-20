<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Paramètres modifiables depuis l'ERP (délai de réservation, TVA, coordonnées…)
 *
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property array<array-key, mixed> $value
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Setting extends Model
{
    protected $fillable = ['group', 'key', 'value'];

    protected function casts(): array
    {
        return ['value' => 'json'];
    }

    /** Setting::get('booking.min_notice_minutes', 120) — mis en cache 10 minutes */
    public static function get(string $key, mixed $default = null): mixed
    {
        // first()?->value et non ->value('value') : value() lit la colonne brute, SANS la conversion JSON du modèle
        return Cache::remember("setting:{$key}", 600, fn () => static::query()->where('key', $key)->first()?->value) ?? $default;
    }

    /** Enregistre un réglage et vide son cache (sinon Setting::get() renverrait l'ancienne valeur 10 minutes) */
    public static function put(string $group, string $key, mixed $value): void
    {
        // null = réglage retiré (la colonne value n'accepte pas NULL) : Setting::get() renverra la valeur par défaut
        $value === null
            ? static::query()->where('key', $key)->delete()
            : static::query()->updateOrCreate(['key' => $key], ['group' => $group, 'value' => $value]);
        Cache::forget("setting:{$key}");
    }

    /** Livraison offerte à partir de ce montant d'achats (hors livraison), ou null si désactivée */
    public static function freeDeliveryThreshold(): ?int
    {
        $value = static::get('delivery.free_threshold');

        return is_numeric($value) && (int) $value > 0 ? (int) $value : null;
    }
}
