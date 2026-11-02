<?php

namespace App\Console\Commands;

use App\Services\Analytics\SnapshotBuilder;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Le « job nocturne » de l'ADR-008. Planifié chaque nuit (routes/console.php) ; lançable à la main :
 *   php artisan analytics:snapshot              -> hier et aujourd'hui
 *   php artisan analytics:snapshot --all        -> tout l'historique (après un import, une correction…)
 *   php artisan analytics:snapshot --from=2026-01-01 --to=2026-03-31
 */
class BuildAnalyticsSnapshotsCommand extends Command
{
    protected $signature = 'analytics:snapshot {--from= : Premier jour (AAAA-MM-JJ)} {--to= : Dernier jour (AAAA-MM-JJ)} {--all : Depuis la première commande ou réservation}';

    protected $description = 'Calcule les agrégats quotidiens (ventes, prestations, stock) lus par le tableau de bord BI';

    public function handle(SnapshotBuilder $builder): int
    {
        $to = $this->option('to') ? CarbonImmutable::parse($this->option('to')) : CarbonImmutable::today();
        $from = match (true) {
            (bool) $this->option('all') => CarbonImmutable::parse(min(array_filter([
                DB::table('orders')->min('placed_at'), DB::table('bookings')->min('starts_at'), DB::table('stock_movements')->min('created_at'),
            ]) ?: [$to->toDateString()])),
            (bool) $this->option('from') => CarbonImmutable::parse($this->option('from')),
            default => $to->subDay(),
        };
        if ($from->gt($to)) {
            $this->error('La date de début doit précéder la date de fin.');

            return self::FAILURE;
        }

        $days = $builder->build($from, $to);
        $this->info("{$days} jour(s) calculé(s), du {$from->toDateString()} au {$to->toDateString()}.");

        return self::SUCCESS;
    }
}
