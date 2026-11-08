<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** Enquête de satisfaction et, si la cliente l'accepte, avis public (docs/13_NOTIFICATIONS_ET_AVIS.md) */
class SatisfactionSurvey extends Model
{
    use LogsActivity;

    /** Note à partir de laquelle le salon doit rappeler la cliente */
    public const FOLLOW_UP_MAX_RATING = 3;

    protected $fillable = [
        'token_hash', 'customer_id', 'booking_id', 'order_id', 'kind', 'subject_label', 'service_id', 'stylist_id',
        'sent_at', 'expires_at', 'answered_at', 'rating', 'nps', 'comment', 'publish_consent', 'review_status',
        'reject_reason', 'reply', 'moderated_by', 'moderated_at', 'follow_up_done_at', 'follow_up_note',
    ];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime', 'expires_at' => 'datetime', 'answered_at' => 'datetime',
            'moderated_at' => 'datetime', 'follow_up_done_at' => 'datetime',
            'rating' => 'integer', 'nps' => 'integer', 'publish_consent' => 'boolean',
        ];
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function findByToken(string $token): ?self
    {
        return static::query()->where('token_hash', self::hashToken($token))->first();
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    public function stylist(): BelongsTo
    {
        return $this->belongsTo(Stylist::class);
    }

    public function isAnswered(): bool
    {
        return $this->answered_at !== null;
    }

    public function isExpired(): bool
    {
        return ! $this->isAnswered() && $this->expires_at->isPast();
    }

    public function needsFollowUp(): bool
    {
        return $this->isAnswered() && $this->rating <= self::FOLLOW_UP_MAX_RATING && $this->follow_up_done_at === null;
    }

    /** « Aïssatou D. » : jamais le nom complet sur le site public */
    public function publicAuthor(): string
    {
        $c = $this->customer;
        $initial = mb_strtoupper(mb_substr((string) $c?->last_name, 0, 1));

        return trim(($c?->first_name ?? 'Cliente').($initial !== '' ? " {$initial}." : ''));
    }

    public function scopeAnswered(Builder $query): void
    {
        $query->whereNotNull('answered_at');
    }

    public function scopePublished(Builder $query): void
    {
        $query->where('review_status', 'approved');
    }

    public function scopeToFollowUp(Builder $query): void
    {
        $query->whereNotNull('answered_at')->where('rating', '<=', self::FOLLOW_UP_MAX_RATING)->whereNull('follow_up_done_at');
    }

    /** Journal d'audit : qui a publié, refusé, répondu ou rappelé */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->useLogName('reviews')
            ->logOnly(['review_status', 'reject_reason', 'reply', 'follow_up_done_at', 'follow_up_note'])
            ->logOnlyDirty()->dontSubmitEmptyLogs();
    }
}
