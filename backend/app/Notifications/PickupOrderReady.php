<?php

namespace App\Notifications;

use App\Models\Order;
use App\Notifications\Channels\SmsMessage;
use Illuminate\Notifications\Messages\MailMessage;

/** Étape 14 : la commande attend la cliente chez le partenaire ; elle donnera son code de retrait */
class PickupOrderReady extends CustomerNotification
{
    public string $reference;

    public string $code;

    public string $place;

    public ?string $hours;

    public int $total;

    public function __construct(Order $order)
    {
        parent::__construct();
        $this->reference = $order->reference;
        $this->code = (string) $order->pickup_code;
        $this->place = "{$order->pickupPoint->name}, {$order->pickupPoint->address}, {$order->pickupPoint->city}";
        $this->hours = $order->pickupPoint->opening_hours;
        $this->total = $order->total;
    }

    public function toSms(object $notifiable): SmsMessage
    {
        return new SmsMessage("Dabo Hair : commande {$this->reference} prête. Code de retrait : {$this->code}. Lieu : {$this->place}. À payer : ".number_format($this->total, 0, ',', ' ').' F.');
    }

    public function toMail(object $notifiable): MailMessage
    {
        return $this->mail($notifiable, "Commande prête à retirer · {$this->reference}")
            ->line("Votre commande vous attend chez notre partenaire : **{$this->place}**".($this->hours ? " ({$this->hours})." : '.'))
            ->line("**Code de retrait : {$this->code}** : donnez-le au partenaire, il vous remettra votre commande.")
            ->line('Montant à régler sur place (espèces ou Wave) : **'.number_format($this->total, 0, ',', ' ').' F CFA**.')
            ->action('Voir ma commande', self::link('compte/commandes'));
    }
}
