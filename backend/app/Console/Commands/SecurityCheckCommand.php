<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Contrôle de la CONFIGURATION avant (et après) une mise en production (OWASP A05).
 *   php artisan app:security-check
 * Code de sortie 1 si un point bloquant est trouvé : utilisable dans un script de déploiement (étape 11).
 */
class SecurityCheckCommand extends Command
{
    protected $signature = 'app:security-check';

    protected $description = 'Vérifie que la configuration est sûre pour la production';

    public function handle(): int
    {
        $prod = app()->isProduction();
        $url = (string) config('app.url');
        $checks = [
            // [bloquant ?, réussi ?, libellé, conseil]
            [true, $prod, 'APP_ENV=production', 'Sinon : comptes de démonstration possibles, messages détaillés…'],
            [true, ! config('app.debug'), 'APP_DEBUG=false', 'En mode debug, une erreur affiche le code source, les requêtes SQL et des secrets.'],
            [true, strlen((string) config('app.key')) >= 32, 'APP_KEY générée', 'php artisan key:generate (chiffre les cookies et les sessions).'],
            [true, Str::startsWith($url, 'https://'), 'APP_URL en https://', "Actuellement : {$url}"],
            [true, (bool) config('session.secure'), 'Cookie de session réservé à HTTPS', 'SESSION_SECURE_COOKIE=true'],
            [true, (bool) config('session.http_only'), 'Cookie de session illisible par JavaScript (HttpOnly)', 'SESSION_HTTP_ONLY=true'],
            [true, ! in_array(config('database.connections.mysql.password'), ['', 'salon_dev_password', 'root', 'password', 'secret'], true), 'Mot de passe de base de données non trivial', 'Le mot de passe de développement ne doit pas servir en production.'],
            [true, ! User::whereIn('email', ['admin@dabohair.test', 'mariama@client.test'])->exists(), 'Aucun compte de démonstration', 'Supprimez admin@dabohair.test et mariama@client.test.'],
            [true, User::role('super_admin')->where('is_active', true)->exists(), 'Un propriétaire (super_admin) actif existe', 'php artisan app:create-admin'],
            [false, config('logging.channels.single.level') !== 'debug' && config('logging.channels.daily.level') !== 'debug', 'Journaux sans niveau « debug »', 'LOG_LEVEL=warning (le niveau debug peut écrire des données personnelles).'],
            [false, config('app.rate_limits.checkout') <= 20 && config('app.rate_limits.api') <= 120, 'Limites anti-abus aux valeurs par défaut', 'Ne pas relever API_RATE_LIMIT / CHECKOUT_RATE_LIMIT en production.'],
            [false, ! in_array('*', (array) config('cors.allowed_origins'), true), 'CORS limité à la vitrine', 'CORS_ALLOWED_ORIGINS=https://votre-domaine'],
            // Étape 13 : sans fournisseur, les messages sont seulement écrits dans les journaux
            [false, config('services.sms.driver') !== 'log', 'SMS réellement envoyés', 'SMS_DRIVER=log : les SMS sont écrits dans storage/logs/sms-*.log, aucune cliente ne les reçoit.'],
            [false, ! in_array(config('mail.default'), ['log', 'array'], true), 'E-mails réellement envoyés', 'MAIL_MAILER=log : configurez un service d’envoi (SMTP), voir docs/13_NOTIFICATIONS_ET_AVIS.md.'],
        ];

        $blocking = 0;
        foreach ($checks as [$isBlocking, $ok, $label, $advice]) {
            if ($ok) {
                $this->line("  <fg=green>OK</>      {$label}");
            } else {
                $isBlocking ? $blocking++ : null;
                $this->line(($isBlocking ? '  <fg=red>BLOQUANT</>' : '  <fg=yellow>CONSEIL</> ')." {$label} : {$advice}");
            }
        }
        $this->newLine();
        if ($blocking) {
            $this->error("{$blocking} point(s) bloquant(s) : ne pas mettre en production en l'état.");

            return self::FAILURE;
        }
        $this->info('Configuration prête pour la production.');

        return self::SUCCESS;
    }
}
