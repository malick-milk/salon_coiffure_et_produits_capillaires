<?php

namespace App\Notifications;

use App\Notifications\Channels\SmsMessage;
use Illuminate\Notifications\Messages\MailMessage;

/** Le salon a confirmé le rendez-vous */
class BookingConfirmed extends BookingNotification
{
    public function toSms(object $notifiable): SmsMessage
    {
        return new SmsMessage("Dabo Hair : votre RDV {$this->service} est confirmé pour {$this->whenText()}. Réf. {$this->reference}. À bientôt !");
    }

    public function toMail(object $notifiable): MailMessage
    {
        return $this->mail($notifiable, "Rendez-vous confirmé · {$this->whenText()}")
            ->line("Votre rendez-vous pour **{$this->service}** est confirmé le **{$this->whenText()}**.")
            ->line('Un empêchement ? Vous pouvez annuler en ligne jusqu’à 24 h avant.')
            ->action('Gérer mon rendez-vous', self::link('compte/reservations'))
            ->line("Référence : {$this->reference}");
    }
}
