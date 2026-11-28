<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Preuve d'un accord (ou d'un retrait) pour les offres par e-mail. Ligne jamais modifiée.
 *
 * @property int $customer_id
 * @property string $channel
 * @property bool $granted
 * @property string $source register | order | booking | salon | account | email_link
 * @property string $text_version
 * @property int|null $recorded_by
 * @property Carbon|null $created_at
 */
class CustomerConsent extends Model
{
    public const UPDATED_AT = null; // une preuve ne se modifie pas

    protected $fillable = ['customer_id', 'channel', 'granted', 'source', 'text_version', 'recorded_by'];

    protected function casts(): array
    {
        return ['granted' => 'boolean', 'created_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
