<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // En développement, Eloquent signale les erreurs silencieuses : chargement paresseux
        // en boucle (requêtes N+1), attribut inexistant, champ non autorisé en « mass assignment »
        Model::shouldBeStrict(! $this->app->isProduction());

        // Limitation de débit (anti-abus, OWASP) : 120 requêtes / minute / utilisateur ou adresse IP
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(config('app.rate_limits.api'))->by($request->user()?->id ?: $request->ip()));

        // Politique de mot de passe des comptes clients (OWASP A07) : 8 caractères, au moins une lettre et un chiffre.
        // En production, on refuse aussi les mots de passe déjà publiés dans une fuite connue (« Have I Been Pwned » :
        // seuls les 5 premiers caractères du hachage SHA-1 quittent le serveur, jamais le mot de passe).
        Password::defaults(fn () => $this->app->isProduction()
            ? Password::min(8)->letters()->numbers()->uncompromised()
            : Password::min(8)->letters()->numbers());

        // Création de réservations, commandes, comptes : 20 par heure et par adresse IP (anti-spam, RG-RES-07)
        RateLimiter::for('checkout', fn (Request $request) => Limit::perHour(config('app.rate_limits.checkout'))->by($request->ip()));
    }
}
