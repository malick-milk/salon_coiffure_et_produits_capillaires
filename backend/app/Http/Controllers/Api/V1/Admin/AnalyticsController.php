<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Analytics\AnalyticsService;
use App\Services\Analytics\CsvExporter;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Tableau de bord décisionnel et exports (EF-BI-01 à 10). Permission : analytics.view (propriétaire) */
class AnalyticsController extends Controller
{
    public function overview(Request $request, AnalyticsService $analytics): JsonResponse
    {
        [$from, $to] = $this->period($request);

        return response()->json(['data' => $analytics->overview($from, $to)]);
    }

    public function export(Request $request, string $dataset, CsvExporter $exporter): StreamedResponse
    {
        validator(['dataset' => $dataset], ['dataset' => ['required', Rule::in(CsvExporter::DATASETS)]])->validate();
        [$from, $to] = $this->period($request);

        return $exporter->download($dataset, $from, $to);
    }

    /** Période par défaut : les 30 derniers jours ; au plus 2 ans, pour protéger la base */
    private function period(Request $request): array
    {
        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:to'],
            'to' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
        ]);
        $to = CarbonImmutable::parse($data['to'] ?? 'today');
        $from = CarbonImmutable::parse($data['from'] ?? $to->subDays(29)->toDateString());
        if ($from->diffInDays($to) > 731) {
            abort(422, 'La période ne peut pas dépasser 2 ans.');
        }

        return [$from, $to];
    }
}
