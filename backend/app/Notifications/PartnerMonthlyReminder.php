<?php

namespace App\Notifications;

use App\Notifications\Channels\SmsMessage;
use Illuminate\Notifications\Messages\MailMessage;

/** Étape 14 : le 1er du mois, rappel du relevé et du versement au plus tard le 5 */
class PartnerMonthlyReminder extends CustomerNotification
{
    public function __construct(public string $month)
    {
        parent::__construct();
    }

    public function toSms(object $notifiable): SmsMessage
    {
        return new SmsMessage("Dabo Hair : bonjour {$notifiable->first_name}, préparez le relevé des produits restants de {$this->month}. Versement au plus tard le 5. Merci !");
    }

    public function toMail(object $notifiable): MailMessage
    {
        return $this->mail($notifiable, "Relevé de {$this->month} : versement avant le 5")
            ->line("Merci de préparer le relevé des produits Dabo Hair qui restent dans votre boutique pour {$this->month}.")
            ->line('Nous le validerons ensemble ; le versement est à faire **au plus tard le 5 du mois**.');
    }
}
