<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Job nocturne de l'ADR-008 : agrégats d'hier (définitifs) et d'aujourd'hui (provisoires).
// En production, une seule tâche cron appelle Laravel chaque minute : « php artisan schedule:run » (étape 11).
Schedule::command('analytics:snapshot')->dailyAt('00:30')->withoutOverlapping();

// Étape 13 : messages aux clientes (Dakar est à l'heure UTC, comme le serveur)
Schedule::command('bookings:remind')->dailyAt('17:00')->withoutOverlapping();
Schedule::command('surveys:send')->dailyAt('10:00')->withoutOverlapping();

// File d'attente des SMS et e-mails, traitée chaque minute par le planificateur déjà appelé par cron.
// --stop-when-empty : le processus s'arrête dès que la file est vide (pas de service à surveiller,
// et chaque mise à jour du site est prise en compte au passage suivant).
Schedule::command('queue:work --stop-when-empty --tries=3 --max-time=50')->everyMinute()->withoutOverlapping();
