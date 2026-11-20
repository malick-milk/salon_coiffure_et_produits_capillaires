<?php

namespace App\Notifications;

use App\Models\ErrorReport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** E-mail à la propriétaire : une erreur est apparue sur le site (au plus une fois par heure pour la même erreur) */
class SiteErrorAlert extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public ErrorReport $report) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $r = $this->report;
        $where = $r->source === 'server' ? 'sur le serveur' : 'dans le navigateur d’une visiteuse';

        return (new MailMessage)
            ->subject('[Dabo Hair] Erreur '.$where.' : '.mb_strimwidth($r->message, 0, 70, '…'))
            ->greeting('Une erreur est apparue sur le site')
            ->line("**Où** : {$where}".($r->location ? " ({$r->location})" : ''))
            ->line("**Message** : {$r->message}")
            ->line("**Vue** {$r->occurrences} fois, la première le ".$r->first_seen_at->format('d/m/Y à H:i').'.')
            ->line('Que faire : consultez la fiche « En cas de problème » (docs/EN_CAS_DE_PROBLEME.md). Si les clientes sont gênées, transmettez ce message à la personne qui maintient le site.')
            ->line('Vous recevrez au plus un e-mail par heure pour cette même erreur.');
    }
}
