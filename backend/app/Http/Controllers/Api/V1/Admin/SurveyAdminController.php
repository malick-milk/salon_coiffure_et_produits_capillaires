<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\SatisfactionSurvey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * ERP « Avis clients » (étape 13) : modérer les avis, rappeler les clientes mécontentes, suivre la satisfaction.
 * Permission : reviews.manage (propriétaire et gérante).
 */
class SurveyAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $f = $request->validate(['filter' => ['nullable', Rule::in(['to_moderate', 'follow_up', 'answered', 'published'])]]);
        $filter = $f['filter'] ?? 'to_moderate';

        $page = SatisfactionSurvey::query()->with(['customer', 'stylist'])
            ->when($filter === 'to_moderate', fn ($q) => $q->where('review_status', 'pending'))
            ->when($filter === 'follow_up', fn ($q) => $q->toFollowUp())
            ->when($filter === 'answered', fn ($q) => $q->answered())
            ->when($filter === 'published', fn ($q) => $q->published())
            ->latest('answered_at')->paginate(20);

        return response()->json([
            'data' => $page->getCollection()->map(fn (SatisfactionSurvey $s) => $this->row($s))->values(),
            'counts' => [
                'to_moderate' => SatisfactionSurvey::query()->where('review_status', 'pending')->count(),
                'follow_up' => SatisfactionSurvey::query()->toFollowUp()->count(),
            ],
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }

    /** Publier ou refuser un avis ; répondre publiquement (aussi après publication) */
    public function review(Request $request, SatisfactionSurvey $survey): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject', 'reply'])],
            'reply' => ['nullable', 'string', 'max:1000'],
            'reject_reason' => ['required_if:decision,reject', 'nullable', Rule::in(['insultes', 'données personnelles', 'publicité', 'hors sujet'])],
        ]);
        if (! $survey->isAnswered() || ! $survey->publish_consent) {
            throw ValidationException::withMessages(['decision' => 'La cliente n’a pas accepté que son avis soit publié.']);
        }
        if ($data['decision'] === 'reply' && $survey->review_status !== 'approved') {
            throw ValidationException::withMessages(['decision' => 'Publiez l’avis avant d’y répondre.']);
        }

        $reply = trim((string) ($data['reply'] ?? '')) ?: null;
        $survey->update(match ($data['decision']) {
            'approve' => ['review_status' => 'approved', 'reject_reason' => null, 'reply' => $reply ?? $survey->reply],
            'reject' => ['review_status' => 'rejected', 'reject_reason' => $data['reject_reason'], 'reply' => null],
            'reply' => ['reply' => $reply],
        } + ['moderated_by' => $request->user()->id, 'moderated_at' => now()]);

        return response()->json(['data' => $this->row($survey->fresh(['customer', 'stylist']))]);
    }

    /** La cliente mécontente a été rappelée : on note ce qui a été fait */
    public function followUp(Request $request, SatisfactionSurvey $survey): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:5', 'max:500']]);
        abort_unless($survey->isAnswered(), 422, 'Cette enquête n’a pas encore de réponse.');
        $survey->update(['follow_up_done_at' => now(), 'follow_up_note' => trim($data['note'])]);

        return response()->json(['data' => $this->row($survey->fresh(['customer', 'stylist']))]);
    }

    /**
     * Indicateurs de satisfaction sur une période (par défaut : 90 derniers jours).
     * NPS = % de promotrices (9-10) − % de détractrices (0-6), de −100 à +100.
     */
    public function stats(Request $request): JsonResponse
    {
        $f = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $from = ($f['from'] ?? now()->subDays(89)->format('Y-m-d')).' 00:00:00';
        $to = ($f['to'] ?? now()->format('Y-m-d')).' 23:59:59';

        $sent = SatisfactionSurvey::query()->whereBetween('sent_at', [$from, $to]);
        $answered = SatisfactionSurvey::query()->answered()->whereBetween('answered_at', [$from, $to]);
        $sentCount = (clone $sent)->count();
        $answeredCount = (clone $answered)->count();

        $group = fn (string $expr, string $label) => (clone $answered)
            ->selectRaw("{$expr} as label, COUNT(*) as answered, ROUND(AVG(rating), 2) as average, {$this->npsSql()} as nps")
            ->groupByRaw($expr)->orderByRaw('COUNT(*) DESC')->get()
            ->map(fn ($r) => [$label => $r->label, 'answered' => (int) $r->answered, 'average' => (float) $r->average, 'nps' => $r->nps === null ? null : (int) round((float) $r->nps)]);

        $byStylist = (clone $answered)->whereNotNull('stylist_id')
            ->join('stylists', 'stylists.id', '=', 'satisfaction_surveys.stylist_id')
            ->selectRaw("stylists.display_name as label, COUNT(*) as answered, ROUND(AVG(rating), 2) as average, {$this->npsSql()} as nps")
            ->groupBy('stylists.id', 'stylists.display_name')->orderByRaw('COUNT(*) DESC')->get()
            ->map(fn ($r) => ['label' => $r->label, 'answered' => (int) $r->answered, 'average' => (float) $r->average, 'nps' => $r->nps === null ? null : (int) round((float) $r->nps)]);

        $overall = (clone $answered)->selectRaw("AVG(rating) as average, {$this->npsSql()} as nps, SUM(nps IS NOT NULL) as nps_answers")->first();

        return response()->json(['data' => [
            'period' => ['from' => substr($from, 0, 10), 'to' => substr($to, 0, 10)],
            'sent' => $sentCount,
            'answered' => $answeredCount,
            'response_rate' => $sentCount ? round($answeredCount / $sentCount * 100, 1) : null,
            'average_rating' => $answeredCount ? round((float) $overall->average, 2) : null,
            'nps' => $overall->nps === null ? null : (int) round((float) $overall->nps),
            'nps_answers' => (int) $overall->nps_answers,
            'by_service' => $group('subject_label', 'label')->where('label', '!=', null)->values()
                ->filter(fn ($r) => ! str_starts_with($r['label'], 'Commande '))->values(),
            'orders' => (clone $answered)->where('kind', 'order')->selectRaw('COUNT(*) as answered, ROUND(AVG(rating), 2) as average')->first()?->only(['answered', 'average']),
            'by_stylist' => $byStylist,
            'by_month' => $group("DATE_FORMAT(answered_at, '%Y-%m')", 'month')->sortBy('month')->values(),
            'counts' => [
                'to_moderate' => SatisfactionSurvey::query()->where('review_status', 'pending')->count(),
                'follow_up' => SatisfactionSurvey::query()->toFollowUp()->count(),
            ],
        ]]);
    }

    /** NPS calculé en SQL ; NULL si personne n'a répondu à la question */
    private function npsSql(): string
    {
        return '(SUM(nps >= 9) - SUM(nps <= 6)) * 100 / NULLIF(SUM(nps IS NOT NULL), 0)';
    }

    private function row(SatisfactionSurvey $s): array
    {
        return [
            'id' => $s->id,
            'kind' => $s->kind,
            'subject_label' => $s->subject_label,
            'customer_name' => $s->customer?->fullName(),
            'customer_phone' => $s->customer?->phone, // pour rappeler la cliente : réservé à l'ERP
            'public_author' => $s->publicAuthor(),
            'stylist_name' => $s->stylist?->display_name,
            'sent_at' => $s->sent_at->format('Y-m-d\TH:i:s'),
            'answered_at' => $s->answered_at?->format('Y-m-d\TH:i:s'),
            'rating' => $s->rating,
            'nps' => $s->nps,
            'comment' => $s->comment,
            'publish_consent' => $s->publish_consent,
            'review_status' => $s->review_status,
            'reject_reason' => $s->reject_reason,
            'reply' => $s->reply,
            'needs_follow_up' => $s->needsFollowUp(),
            'follow_up_done_at' => $s->follow_up_done_at?->format('Y-m-d\TH:i:s'),
            'follow_up_note' => $s->follow_up_note,
        ];
    }
}
