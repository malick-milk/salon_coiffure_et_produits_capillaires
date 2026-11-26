<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Pièce du dossier (contrat signé, CNI…) : fichier sur le disque PRIVÉ, téléchargeable par la propriétaire seulement.
 *
 * @property int $employee_id
 * @property int|null $employment_contract_id
 * @property string $kind contract | id_card | other
 * @property string $original_name
 * @property string $path
 * @property string $mime
 * @property int $size
 * @property int|null $uploaded_by
 * @property Carbon|null $created_at
 */
class EmployeeDocument extends Model
{
    protected $fillable = ['employee_id', 'employment_contract_id', 'kind', 'original_name', 'path', 'mime', 'size', 'uploaded_by'];

    protected function casts(): array
    {
        return ['size' => 'integer'];
    }

    /** @return BelongsTo<Employee, $this> */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
