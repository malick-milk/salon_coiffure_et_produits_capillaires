<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Un congé pris (payé, maternité, maladie…).
 *
 * @property int $employee_id
 * @property string $kind paid | maternity | sick | other
 * @property Carbon $starts_on
 * @property Carbon $ends_on
 * @property string $days
 * @property string|null $note
 */
class EmployeeLeave extends Model
{
    protected $fillable = ['employee_id', 'kind', 'starts_on', 'ends_on', 'days', 'note'];

    protected function casts(): array
    {
        return ['starts_on' => 'date', 'ends_on' => 'date', 'days' => 'decimal:1'];
    }
}
