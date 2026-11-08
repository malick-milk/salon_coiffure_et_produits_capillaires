<?php

namespace App\Notifications;

use App\Models\Booking;
use App\Notifications\Channels\SmsMessage;
use Illuminate\Notifications\Messages\MailMessage;

/** Le salon annule : la cliente reçoit le MOTIF, des excuses et un lien pour choisir un autre créneau */
class BookingCancelledBySalon extends BookingNotification
{
    public string $reason;

    public function __construct(Booking $booking)
    {
        parent::__construct($booking);
        $this->reason = (string) $booking->cancellation_reason;
    }

    public function toSms(object $notifiable): SmsMessage
    {
        return new SmsMessage("Dabo Hair : désolés, votre RDV du {$this->whenText()} est annulé. Motif : {$this->reason}. Nouveau créneau : ".self::link('reserver'));
    }

    public function toMail(object $notifiable): MailMessage
    {
        return $this->mail($notifiable, "Rendez-vous annulé · {$this->reference}")
            ->line("Nous sommes désolés : votre rendez-vous pour **{$this->service}** du **{$this->whenText()}** a dû être annulé.")
            ->line("**Motif :** {$this->reason}")
            ->line('Nous serions ravis de vous accueillir à un autre moment.')
            ->action('Choisir un nouveau créneau', self::link('reserver'))
            ->line("Référence : {$this->reference}");
    }
}
