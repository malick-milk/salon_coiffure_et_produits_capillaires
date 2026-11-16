<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Prestation du salon
 *
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property int $duration_minutes
 * @property int $buffer_minutes
 * @property int $price
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Service extends Model
{
    use SoftDeletes;

    protected $fillable = ['service_category_id', 'name', 'slug', 'description', 'duration_minutes', 'buffer_minutes', 'price', 'image_path', 'is_active', 'position', 'resserrage_service_id', 'resserrage_after_days'];

    protected function casts(): array
    {
        return ['duration_minutes' => 'integer', 'buffer_minutes' => 'integer', 'price' => 'integer', 'is_active' => 'boolean'];
    }

    /** @return BelongsTo<ServiceCategory, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class, 'service_category_id');
    }

    /** @return BelongsToMany<Stylist, $this> */
    public function stylists(): BelongsToMany
    {
        return $this->belongsToMany(Stylist::class);
    }

    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /**
     * Le resserrage qui correspond à ce twist (rappels de resserrage, 16 novembre 2026)
     *
     * @return BelongsTo<Service, $this>
     */
    public function resserrageService(): BelongsTo
    {
        return $this->belongsTo(self::class, 'resserrage_service_id');
    }
}
