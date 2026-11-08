<?php

namespace App\Notifications;

use App\Notifications\Channels\SmsMessage;
use Illuminate\Notifications\Messages\MailMessage;

/** Confirmation de l'annulation faite par la cliente depuis son compte */
class BookingCancelledByCustomer extends BookingNotification
{
    public function toSms(object $notifiable): SmsMessage
    {
        return new SmsMessage("Dabo Hair : votre RDV du {$this->whenText()} est bien annulé. Réf. {$this->reference}.");
    }

    public function toMail(object $notifiable): MailMessage
    {
        return $this->mail($notifiable, "Annulation confirmée · {$this->reference}")
            ->line("Votre rendez-vous pour **{$this->service}** du **{$this->whenText()}** est bien annulé.")
            ->action('Réserver un autre créneau', self::link('reserver'));
    }
}
