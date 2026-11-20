<?php

namespace App\Console\Commands;

use App\Models\ErrorReport;
use Illuminate\Console\Command;

/** Les erreurs plus vues depuis 90 jours sont effacées (on ne garde pas de données sans raison) */
class PurgeErrorReportsCommand extends Command
{
    protected $signature = 'errors:purge {--days=90}';

    protected $description = 'Efface les erreurs du site plus vues depuis 90 jours';

    public function handle(): int
    {
        $count = ErrorReport::query()->where('last_seen_at', '<', now()->subDays((int) $this->option('days')))->delete();
        $this->info("{$count} erreur(s) effacée(s).");

        return self::SUCCESS;
    }
}
