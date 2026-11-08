<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SatisfactionSurvey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Avis clients publics (étape 13) : seuls les avis validés par le salon ; la note moyenne porte sur TOUTES les réponses */
class ReviewController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 6), 1), 24);
        $page = SatisfactionSurvey::query()->published()->with('customer')
            ->latest('answered_at')->paginate($perPage);

        // Moyenne honnête : toutes les clientes qui ont répondu, publiées ou non
        $answered = SatisfactionSurvey::query()->answered();
        $count = (clone $answered)->count();
        $distribution = (clone $answered)->selectRaw('rating, COUNT(*) as n')->groupBy('rating')->pluck('n', 'rating');

        return response()->json([
            'data' => $page->getCollection()->map(fn (SatisfactionSurvey $s) => [
                'id' => $s->id,
                'author' => $s->publicAuthor(),
                'kind' => $s->kind,
                'subject_label' => $s->kind === 'booking' ? $s->subject_label : 'Commande en ligne',
                'rating' => $s->rating,
                'comment' => $s->comment,
                'reply' => $s->reply,
                'date' => $s->answered_at->format('Y-m-d'),
            ])->values(),
            'summary' => [
                'average' => $count ? round((float) (clone $answered)->avg('rating'), 1) : null,
                'answered_count' => $count,
                'published_count' => $page->total(),
                'distribution' => collect(range(5, 1))->mapWithKeys(fn ($r) => [$r => (int) ($distribution[$r] ?? 0)]),
            ],
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }
}
