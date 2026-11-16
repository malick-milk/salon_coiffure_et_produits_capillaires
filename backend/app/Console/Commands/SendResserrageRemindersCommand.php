<?php

namespace App\Console\Commands;

use App\Services\Salon\ResserrageReminderService;
use Illuminate\Console\Command;

/** Chaque matin : rappels de resserrage (espace client + e-mail, jamais de SMS pour l'instant) */
class SendResserrageRemindersCommand extends Command
{
    protected $signature = 'bookings:resserrage';

    protected $description = 'Envoie les rappels de resserrage arrivés à échéance (délai conseillé par prestation)';

    public function handle(ResserrageReminderService $reminders): int
    {
        ['sent' => $sent, 'skipped' => $skipped] = $reminders->run();
        $this->info("{$sent} rappel(s) de resserrage envoyé(s), {$skipped} écarté(s) (déjà réservé, désinscrite ou sans moyen de contact).");

        return self::SUCCESS;
    }
}
