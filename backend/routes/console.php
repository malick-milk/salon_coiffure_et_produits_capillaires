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
