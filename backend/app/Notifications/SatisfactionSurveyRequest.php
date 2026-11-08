<?php

namespace App\Notifications;

use App\Models\SatisfactionSurvey;
use App\Notifications\Channels\SmsMessage;
use Illuminate\Notifications\Messages\MailMessage;

/** Lendemain d'une prestation ou d'une livraison : lien personnel vers l'enquête (valable 14 jours, une seule réponse) */
class SatisfactionSurveyRequest extends CustomerNotification
{
    public string $subject;

    public string $kind;

    /** @param string $token lien en clair : il n'existe QUE dans ce message, la base n'en garde que l'empreinte */
    public function __construct(SatisfactionSurvey $survey, public string $token)
    {
        parent::__construct();
        $this->subject = $survey->subject_label;
        $this->kind = $survey->kind;
    }

    private function url(): string
    {
        return self::link("avis/{$this->token}");
    }

    public function toSms(object $notifiable): SmsMessage
    {
        $what = $this->kind === 'booking' ? 'votre passage au salon' : 'votre commande';

        return new SmsMessage("Dabo Hair : comment s'est passé {$what} ? Donnez votre avis en 20 secondes : {$this->url()}");
    }

    public function toMail(object $notifiable): MailMessage
    {
        $what = $this->kind === 'booking' ? "votre passage au salon ({$this->subject})" : "votre commande ({$this->subject})";

        return $this->mail($notifiable, 'Votre avis compte pour nous')
            ->line("Merci pour {$what}.")
            ->line('Votre avis nous aide à nous améliorer. Il ne prend que 20 secondes.')
            ->action('Donner mon avis', $this->url())
            ->line('Ce lien est personnel et valable 14 jours.');
    }
}
