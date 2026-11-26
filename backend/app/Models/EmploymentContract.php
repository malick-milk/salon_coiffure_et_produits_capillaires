<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Un contrat de travail (ou de prestation) d'une personne de l'équipe.
 * Règles légales : App\Services\Hr\ContractRules.
 *
 * @property int $employee_id
 * @property string $type cdi | cdd | apprentissage | stage | prestataire
 * @property string $position
 * @property Carbon $starts_on
 * @property Carbon|null $ends_on
 * @property Carbon|null $trial_ends_on
 * @property int|null $weekly_hours
 * @property string|null $work_days
 * @property int|null $base_salary
 * @property string $commission_rate
 * @property string|null $pay_method
 * @property int $renewal_count
 * @property Carbon|null $signed_on
 * @property Carbon|null $ended_on
 * @property string|null $end_reason
 * @property string|null $end_note
 * @property int|null $previous_contract_id
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class EmploymentContract extends Model
{
    use LogsActivity;

    public const TYPES = ['cdi', 'cdd', 'apprentissage', 'stage', 'prestataire'];

    /** Types qui ont une date de fin prévue */
    public const FIXED_TERM = ['cdd', 'apprentissage', 'stage'];

    public const PAY_METHODS = ['cash', 'wave', 'orange_money', 'free_money', 'bank'];

    protected $fillable = ['employee_id', 'type', 'position', 'starts_on', 'ends_on', 'trial_ends_on', 'weekly_hours', 'work_days', 'base_salary',
        'commission_rate', 'pay_method', 'renewal_count', 'signed_on', 'ended_on', 'end_reason', 'end_note', 'previous_contract_id', 'created_by'];

    protected function casts(): array
    {
        return ['starts_on' => 'date', 'ends_on' => 'date', 'trial_ends_on' => 'date', 'signed_on' => 'date', 'ended_on' => 'date',
            'weekly_hours' => 'integer', 'base_salary' => 'integer', 'commission_rate' => 'decimal:2', 'renewal_count' => 'integer'];
    }

    /** @return BelongsTo<Employee, $this> */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    /** @return BelongsTo<EmploymentContract, $this> */
    public function previous(): BelongsTo
    {
        return $this->belongsTo(self::class, 'previous_contract_id');
    }

    public function isFixedTerm(): bool
    {
        return in_array($this->type, self::FIXED_TERM, true);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('hr')
            ->logOnly(['type', 'position', 'starts_on', 'ends_on', 'trial_ends_on', 'base_salary', 'commission_rate', 'renewal_count', 'signed_on', 'ended_on', 'end_reason'])
            ->logOnlyDirty()->dontSubmitEmptyLogs();
    }
}
