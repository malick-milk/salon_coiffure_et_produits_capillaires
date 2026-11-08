<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SatisfactionSurvey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Enquête de satisfaction, côté cliente (étape 13). Pas de compte : le lien personnel suffit.
 * Le jeton n'est jamais stocké en clair : on cherche son empreinte SHA-256.
 */
class SurveyController extends Controller
{
    public function show(string $token): JsonResponse
    {
        $survey = $this->find($token);

        return response()->json(['data' => [
            'kind' => $survey->kind,
            'subject_label' => $survey->subject_label,
            'first_name' => $survey->customer?->first_name,
            'state' => $survey->isAnswered() ? 'answered' : ($survey->isExpired() ? 'expired' : 'open'),
        ]]);
    }

    public function answer(Request $request, string $token): JsonResponse
    {
        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'nps' => ['nullable', 'integer', 'between:0,10'],
            'comment' => ['nullable', 'string', 'max:1000'],
            'publish_consent' => ['required', 'boolean'],
        ]);

        return DB::transaction(function () use ($token, $data) {
            // Verrou : deux envois simultanés du même formulaire ne créent pas deux réponses
            $survey = SatisfactionSurvey::query()->where('token_hash', SatisfactionSurvey::hashToken($token))->lockForUpdate()->first();
            abort_unless($survey, 404, 'Lien d’enquête introuvable.');
            abort_if($survey->isAnswered(), 409, 'Vous avez déjà répondu : merci !');
            abort_if($survey->isExpired(), 410, 'Ce lien a expiré.');

            $comment = trim((string) ($data['comment'] ?? '')) ?: null;
            $survey->update([
                'answered_at' => now(),
                'rating' => $data['rating'],
                'nps' => $data['nps'] ?? null,
                'comment' => $comment,
                'publish_consent' => $data['publish_consent'],
                // Toutes les notes peuvent être publiées (pas de tri des seuls bons avis) ; le salon modère
                'review_status' => $data['publish_consent'] ? 'pending' : 'none',
            ]);

            return response()->json(['data' => [
                'state' => 'answered',
                'follow_up' => $survey->rating <= SatisfactionSurvey::FOLLOW_UP_MAX_RATING,
            ]], 201);
        });
    }

    private function find(string $token): SatisfactionSurvey
    {
        $survey = SatisfactionSurvey::query()->with('customer')->where('token_hash', SatisfactionSurvey::hashToken($token))->first();
        abort_unless($survey, 404, 'Lien d’enquête introuvable.');

        return $survey;
    }
}
