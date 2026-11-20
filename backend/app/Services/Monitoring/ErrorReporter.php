<?php

namespace App\Services\Monitoring;

use App\Models\ErrorReport;
use App\Notifications\SiteErrorAlert;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Throwable;

/**
 * SUIVI DES ERREURS hébergé sur notre serveur (21 novembre 2026) : aucune donnée ne part chez un service extérieur.
 *
 * - Une erreur = une ligne, repérée par son empreinte ; les répétitions augmentent le compteur.
 * - Données sensibles masquées AVANT l'enregistrement : e-mails, téléphones, jetons, mots de passe.
 * - E-mail à ALERT_EMAIL (la propriétaire) à la 1re apparition, puis au plus une fois par heure pour la même erreur.
 * - Ne doit JAMAIS faire planter le site : toute panne du suivi lui-même est seulement écrite dans le journal.
 */
class ErrorReporter
{
    /** Pas plus d'un e-mail par heure pour une même erreur */
    private const NOTIFY_EVERY_MINUTES = 60;

    /** Erreurs NOUVELLES venant des navigateurs acceptées par jour (au-delà : compteur seulement, contre le spam) */
    private const NEW_BROWSER_ERRORS_PER_DAY = 50;

    private static bool $busy = false; // une erreur pendant l'enregistrement d'une erreur : pas de boucle

    public function fromException(Throwable $e): void
    {
        $this->record('server', $e::class, $e->getMessage(), $this->relative($e->getFile()).':'.$e->getLine(), [
            'route' => request()->route()?->uri(), 'method' => request()->method(),
            'trace' => collect($e->getTrace())->take(5)->map(fn ($f) => ($f['class'] ?? '').($f['type'] ?? '').($f['function'] ?? '').(isset($f['line']) ? ':'.$f['line'] : ''))->all(),
        ]);
    }

    /** @param array<string, mixed> $context */
    public function fromBrowser(string $type, string $message, ?string $page, array $context): ?ErrorReport
    {
        return $this->record('browser', $type, $message, $page, $context);
    }

    /** Masque ce qui permettrait d'identifier une cliente ou d'ouvrir une session */
    public static function scrub(string $text): string
    {
        return (string) preg_replace(
            ['/[\w.+-]+@[\w-]+\.[\w.-]+/u', '/(\+?221[\s.-]?)?\b7[05678](?:[\s.-]?\d){7}\b/u', '/\b[A-Za-z0-9_\-]{32,}\b/', '/(password|mot_de_passe|token|code)(["\']?\s*[:=]\s*)\S+/i'],
            ['[e-mail]', '[téléphone]', '[jeton]', '$1$2[masqué]'],
            $text,
        );
    }

    /** @param array<string, mixed> $context */
    private function record(string $source, string $type, string $message, ?string $location, array $context): ?ErrorReport
    {
        if (self::$busy) {
            return null;
        }
        self::$busy = true;
        try {
            $message = mb_substr(self::scrub(trim($message)) ?: '(sans message)', 0, 500);
            $location = $location === null ? null : mb_substr(self::scrub($location), 0, 300);
            $fingerprint = hash('sha256', implode('|', [$source, $type, $message, $location]));
            $context = json_decode(self::scrub((string) json_encode($context, JSON_UNESCAPED_UNICODE)), true);

            $report = ErrorReport::query()->where('fingerprint', $fingerprint)->first();
            if ($report) {
                $report->increment('occurrences', 1, ['last_seen_at' => now(), 'context' => $context]);
            } else {
                if ($source === 'browser' && ErrorReport::query()->where('source', 'browser')->where('first_seen_at', '>=', now()->startOfDay())->count() >= self::NEW_BROWSER_ERRORS_PER_DAY) {
                    return null; // trop de NOUVELLES erreurs navigateur aujourd'hui : probablement du spam
                }
                $report = ErrorReport::create([
                    'source' => $source, 'fingerprint' => $fingerprint, 'type' => mb_substr($type, 0, 191), 'message' => $message,
                    'location' => $location, 'context' => $context, 'first_seen_at' => now(), 'last_seen_at' => now(),
                ]);
            }
            $this->notify($report);

            return $report;
        } catch (Throwable $failure) {
            Log::warning('Suivi des erreurs indisponible : '.$failure->getMessage());

            return null;
        } finally {
            self::$busy = false;
        }
    }

    private function notify(ErrorReport $report): void
    {
        $to = config('services.alerts.email');
        if (! $to || ($report->notified_at && $report->notified_at->gt(now()->subMinutes(self::NOTIFY_EVERY_MINUTES)))) {
            return;
        }
        $report->forceFill(['notified_at' => now()])->save();
        Notification::route('mail', $to)->notify(new SiteErrorAlert($report));
    }

    private function relative(string $file): string
    {
        return str_replace(base_path().DIRECTORY_SEPARATOR, '', $file);
    }
}
