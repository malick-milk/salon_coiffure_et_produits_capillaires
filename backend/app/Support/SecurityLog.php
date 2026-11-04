<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Journal de SÉCURITÉ (OWASP A09) : storage/logs/security-AAAA-MM-JJ.log, conservé 90 jours.
 * Il répond à « quelqu'un essaie-t-il d'entrer ? » : échecs de connexion, blocages, accès refusés.
 *
 * Minimisation : l'email est masqué (m***@client.test), aucun mot de passe ni jeton n'est jamais écrit.
 * Une ligne = un événement au format JSON, facile à filtrer (grep, outil de supervision).
 */
final class SecurityLog
{
    public static function event(string $event, Request $request, array $context = [], string $level = 'warning'): void
    {
        Log::channel('security')->log($level, $event, [
            'ip' => $request->ip(),
            'method' => $request->method(),
            'path' => '/'.ltrim($request->path(), '/'),
            'user_id' => $request->user()?->id,
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 160),
            ...$context,
        ]);
    }

    /** « mariama@client.test » -> « m***@client.test » : assez pour enquêter, pas une liste d'emails */
    public static function maskEmail(?string $email): ?string
    {
        if (! $email || ! str_contains($email, '@')) {
            return $email ? '***' : null;
        }
        [$local, $domain] = explode('@', $email, 2);

        return mb_substr($local, 0, 1).'***@'.$domain;
    }
}
