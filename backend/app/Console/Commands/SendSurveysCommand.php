<?php

namespace App\Console\Commands;

use App\Services\Satisfaction\SurveyService;
use Illuminate\Console\Command;

/** Chaque matin : enquêtes de satisfaction pour les prestations terminées et commandes livrées (étape 13) */
class SendSurveysCommand extends Command
{
    protected $signature = 'surveys:send';

    protected $description = 'Envoie les enquêtes de satisfaction (lendemain d’une prestation ou d’une livraison)';

    public function handle(SurveyService $surveys): int
    {
        $this->info($surveys->sendDue().' enquête(s) envoyée(s).');

        return self::SUCCESS;
    }
}
