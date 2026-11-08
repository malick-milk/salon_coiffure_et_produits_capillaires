<?php

namespace App\Notifications;

use App\Models\Order;
use App\Notifications\Channels\SmsMessage;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Étape 14 : au partenaire, une commande à remettre. Le lien personnel ouvre une page où il saisit
 * le code donné par la cliente : la commande ne peut pas être remise à quelqu'un d'autre.
 */
class PickupOrderToHandOver extends CustomerNotification
{
    public string $reference;

    public string $customer;

    public string $items;

    public int $total;

    public function __construct(Order $order, public string $token)
    {
        parent::__construct();
        $this->reference = $order->reference;
        $this->customer = $order->customer->fullName();
        $this->items = $order->items->map(fn ($i) => "{$i->quantity} × {$i->product_name}")->implode(', ');
        $this->total = $order->total;
    }

    private function url(): string
    {
        return self::link("retrait/{$this->token}");
    }

    public function toSms(object $notifiable): SmsMessage
    {
        return new SmsMessage("Dabo Hair : commande {$this->reference} pour {$this->customer}, à encaisser ".number_format($this->total, 0, ',', ' ')." F. Remise avec son code : {$this->url()}");
    }

    public function toMail(object $notifiable): MailMessage
    {
        return $this->mail($notifiable, "Commande à remettre · {$this->reference}")
            ->line("Une cliente, **{$this->customer}**, viendra retirer la commande {$this->reference} : {$this->items}.")
            ->line('Montant à encaisser : **'.number_format($this->total, 0, ',', ' ').' F CFA**, au prix du site.')
            ->line('Au moment de la remise, demandez-lui son code de retrait à 4 chiffres et saisissez-le sur cette page :')
            ->action('Confirmer la remise', $this->url());
    }
}
