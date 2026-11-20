<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Monitoring\ErrorReporter;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Erreurs JavaScript vues dans le navigateur d'une visiteuse (21 novembre 2026).
 * Route publique, donc limitée : 20 envois par minute et par adresse IP, tailles bornées, données masquées,
 * et au plus 50 erreurs NOUVELLES par jour (ErrorReporter). Le contenu n'est jamais exécuté ni affiché en HTML.
 */
class ClientErrorController extends Controller
{
    public function store(Request $request, ErrorReporter $reporter): Response
    {
        $data = $request->validate([
            'type' => ['required', 'string', 'max:100'],
            'message' => ['required', 'string', 'max:1000'],
            'page' => ['nullable', 'string', 'max:300'],
            'stack' => ['nullable', 'string', 'max:2000'],
        ]);
        // Seulement le chemin de la page : la partie après « ? » peut contenir un jeton (lien de désinscription…)
        $page = $data['page'] !== null ? strtok($data['page'], '?#') : null;
        $reporter->fromBrowser($data['type'], $data['message'], $page ?: null, [
            'stack' => array_slice(explode("\n", (string) ($data['stack'] ?? '')), 0, 5),
            'browser' => mb_substr((string) $request->userAgent(), 0, 200),
        ]);

        return response()->noContent();
    }
}
