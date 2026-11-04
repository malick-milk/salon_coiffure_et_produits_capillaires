<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * En-têtes de sécurité HTTP (OWASP A05 : mauvaise configuration de sécurité).
 * Ce sont des CONSIGNES données au navigateur ; elles ne coûtent rien et ferment des classes d'attaques entières.
 * Les en-têtes de la vitrine React (dont sa Content-Security-Policy) sont posés par le serveur web (étape 11).
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $headers = $response->headers;

        $headers->set('X-Content-Type-Options', 'nosniff');           // le navigateur ne « devine » pas le type d'un fichier
        $headers->set('X-Frame-Options', 'DENY');                     // pas d'affichage dans une iframe (anti-clickjacking)
        $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin'); // les URL complètes ne fuient pas vers d'autres sites
        $headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
        $headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        $headers->remove('X-Powered-By');                             // ne pas annoncer la version de PHP

        // Une réponse JSON n'a jamais besoin de charger de script, d'image ou de style :
        // la politique la plus stricte possible. (Le PDF de facture garde le lecteur intégré du navigateur.)
        if (str_contains((string) $headers->get('Content-Type'), 'json')) {
            $headers->set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
        }

        // HSTS : « ce site ne se visite QU'EN HTTPS, pendant 1 an ». Seulement sur une connexion déjà sécurisée,
        // sinon un poste de développement en http://localhost serait bloqué.
        if ($request->isSecure()) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
