<?php

namespace App\Notifications;

use App\Notifications\Channels\SmsMessage;
use Illuminate\Notifications\Messages\MailMessage;

/** Réservation en ligne enregistrée (statut « en attente » : le salon la confirmera) */
class BookingReceived extends BookingNotification
{
    public function toSms(object $notifiable): SmsMessage
    {
        return new SmsMessage("Dabo Hair : demande de RDV reçue ({$this->service}, {$this->whenText()}). Réf. {$this->reference}. Nous vous confirmons très vite.");
    }

    public function toMail(object $notifiable): MailMessage
    {
        return $this->mail($notifiable, "Demande de rendez-vous reçue · {$this->reference}")
            ->line("Nous avons bien reçu votre demande de rendez-vous pour **{$this->service}**, le **{$this->whenText()}**.")
            ->line('Le salon la confirme dans les plus brefs délais : vous recevrez un message.')
            ->action('Voir mes rendez-vous', self::link('compte/reservations'))
            ->line("Référence : {$this->reference}");
    }
}
