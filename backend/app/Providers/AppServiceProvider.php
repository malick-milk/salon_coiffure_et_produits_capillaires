<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

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
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by($request->user()?->id ?: $request->ip()));

        // Création de réservations, commandes, comptes : 20 par heure et par adresse IP (anti-spam, RG-RES-07)
        RateLimiter::for('checkout', fn (Request $request) => Limit::perHour(20)->by($request->ip()));
    }
}
