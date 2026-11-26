<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Une personne de l'équipe (module Contrats et RH, 26 novembre 2026).
 * Les numéros CNI, IPRES et CSS sont CHIFFRÉS en base (cast « encrypted ») et ne vont jamais au journal d'audit.
 *
 * @property string $first_name
 * @property string $last_name
 * @property string|null $phone
 * @property Carbon|null $birth_date
 * @property string|null $address
 * @property string|null $id_number
 * @property string|null $ipres_number
 * @property string|null $css_number
 * @property int|null $user_id
 * @property int|null $stylist_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Employee extends Model
{
    use LogsActivity;

    protected $fillable = ['first_name', 'last_name', 'phone', 'birth_date', 'address', 'id_number', 'ipres_number', 'css_number', 'user_id', 'stylist_id'];

    protected function casts(): array
    {
        return ['birth_date' => 'date', 'id_number' => 'encrypted', 'ipres_number' => 'encrypted', 'css_number' => 'encrypted'];
    }

    public function fullName(): string
    {
        return trim($this->first_name.' '.$this->last_name);
    }

    /** @return HasMany<EmploymentContract, $this> */
    public function contracts(): HasMany
    {
        return $this->hasMany(EmploymentContract::class);
    }

    /** Le contrat en cours (pas encore terminé), le plus récent @return HasOne<EmploymentContract, $this> */
    public function currentContract(): HasOne
    {
        return $this->hasOne(EmploymentContract::class)->whereNull('ended_on')->latestOfMany('starts_on');
    }

    /** @return HasMany<EmployeeDocument, $this> */
    public function documents(): HasMany
    {
        return $this->hasMany(EmployeeDocument::class);
    }

    /** @return HasMany<EmployeeLeave, $this> */
    public function leaves(): HasMany
    {
        return $this->hasMany(EmployeeLeave::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Stylist, $this> */
    public function stylist(): BelongsTo
    {
        return $this->belongsTo(Stylist::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        // Jamais les numéros d'identité : le journal d'audit ne doit pas devenir une copie en clair
        return LogOptions::defaults()->useLogName('hr')->logOnly(['first_name', 'last_name', 'phone', 'user_id', 'stylist_id'])->logOnlyDirty()->dontSubmitEmptyLogs();
    }
}
