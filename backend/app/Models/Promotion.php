<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Promotion en pourcentage sur des produits, pendant des dates (maquettes validées le 20 novembre 2026).
 * Le prix des produits ne change pas : App\Services\Catalog\PromotionService calcule le prix promo.
 *
 * @property string $name
 * @property int $percent
 * @property Carbon $starts_on
 * @property Carbon $ends_on
 * @property string $audience all | members
 * @property Carbon|null $stopped_at
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Promotion extends Model
{
    use LogsActivity;

    protected $fillable = ['name', 'percent', 'starts_on', 'ends_on', 'audience', 'stopped_at', 'created_by'];

    protected function casts(): array
    {
        return ['percent' => 'integer', 'starts_on' => 'date', 'ends_on' => 'date', 'stopped_at' => 'datetime'];
    }

    /** @return BelongsToMany<Product, $this> */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class);
    }

    /** @return HasMany<OrderItem, $this> */
    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /** En cours aujourd'hui : commencée, pas finie, pas arrêtée */
    public function scopeRunning(Builder $query): void
    {
        $today = now()->toDateString();
        $query->whereNull('stopped_at')->where('starts_on', '<=', $today)->where('ends_on', '>=', $today);
    }

    /** Dernier jour réel de la promotion : la date de fin, ou la veille de l'arrêt */
    public function lastDay(): Carbon
    {
        $stopped = $this->stopped_at?->copy()->startOfDay();
        $end = $this->ends_on->copy();

        return $stopped && $stopped->lte($end) ? $stopped : $end;
    }

    /** current (en cours) | upcoming (à venir) | ended (terminée ou arrêtée) */
    public function status(): string
    {
        $today = now()->startOfDay();

        return match (true) {
            $this->stopped_at !== null || $this->ends_on->lt($today) => 'ended',
            $this->starts_on->gt($today) => 'upcoming',
            default => 'current',
        };
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('promotions')->logOnly(['name', 'percent', 'starts_on', 'ends_on', 'audience', 'stopped_at'])->logOnlyDirty()->dontSubmitEmptyLogs();
    }
}
