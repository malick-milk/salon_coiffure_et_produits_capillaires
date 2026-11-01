<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Prestation du salon */
class Service extends Model
{
    use SoftDeletes;

    protected $fillable = ['service_category_id', 'name', 'slug', 'description', 'duration_minutes', 'buffer_minutes', 'price', 'image_path', 'is_active', 'position'];

    protected function casts(): array
    {
        return ['duration_minutes' => 'integer', 'buffer_minutes' => 'integer', 'price' => 'integer', 'is_active' => 'boolean'];
    }

    public function category(): BelongsTo { return $this->belongsTo(ServiceCategory::class, 'service_category_id'); }
    public function stylists(): BelongsToMany { return $this->belongsToMany(Stylist::class); }

    public function scopeActive(Builder $query): void { $query->where('is_active', true); }
}
