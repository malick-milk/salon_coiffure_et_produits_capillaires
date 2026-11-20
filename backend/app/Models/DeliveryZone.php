<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Types pour l'analyse statique (Larastan) : colonnes converties et dates.
 *
 * @property string $name
 * @property int $fee
 * @property string|null $delay_label
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class DeliveryZone extends Model
{
    use LogsActivity;

    protected $fillable = ['name', 'fee', 'delay_label', 'is_active'];

    /** Chaque changement de tarif va au journal d'audit (maquette « Livraison » du 21 novembre 2026) */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('delivery')->logOnly(['name', 'fee', 'delay_label', 'is_active'])->logOnlyDirty()->dontSubmitEmptyLogs();
    }

    protected function casts(): array
    {
        return ['fee' => 'integer', 'is_active' => 'boolean'];
    }

    /** Portée locale : DeliveryZone::active()->get() */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }
}
