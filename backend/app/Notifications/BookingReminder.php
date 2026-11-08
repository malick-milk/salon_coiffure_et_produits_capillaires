<?php

namespace App\Notifications;

use App\Notifications\Channels\SmsMessage;
use Illuminate\Notifications\Messages\MailMessage;

/** Rappel envoyé la veille (commande bookings:remind) : moins de rendez-vous oubliés */
class BookingReminder extends BookingNotification
{
    public function toSms(object $notifiable): SmsMessage
    {
        $phone = $this->salonPhone();

        return new SmsMessage("Dabo Hair : rappel de votre RDV demain, {$this->whenText()} ({$this->service})."
            .($phone ? " Empêchement ? Appelez le {$phone}." : ''));
    }

    public function toMail(object $notifiable): MailMessage
    {
        return $this->mail($notifiable, "Rappel : rendez-vous demain · {$this->whenText()}")
            ->line("Nous vous attendons demain, **{$this->whenText()}**, pour **{$this->service}**.")
            ->line('En cas d’empêchement, merci de nous prévenir : le créneau profitera à une autre cliente.')
            ->action('Voir mon rendez-vous', self::link('compte/reservations'));
    }
}
