<?php

namespace App\Notifications;

use App\Models\Booking;
use App\Models\Service;
use App\Notifications\Channels\SmsMessage;
use App\Support\Resserrage;
use Carbon\CarbonImmutable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

/**
 * Rappel de resserrage (maquette validée le 16 novembre 2026).
 * Canaux : la rubrique « Notifications » du profil (si la cliente a un compte) et l'e-mail (si l'adresse
 * est connue). JAMAIS de SMS pour l'instant : leur coût sera présenté plus tard.
 */
class ResserrageReminder extends CustomerNotification
{
    public string $reference;

    public string $twist;

    public CarbonImmutable $doneOn;

    public CarbonImmutable $advisedOn;

    public string $delayLabel;

    /** @var array{slug:string,name:string,price:int,duration_minutes:int} */
    public array $resserrage;

    public function __construct(Booking $booking, Service $resserrage, int $afterDays)
    {
        parent::__construct();
        $this->reference = $booking->reference;
        $this->twist = $booking->service_name;
        $this->doneOn = CarbonImmutable::parse($booking->starts_at)->startOfDay();
        $this->advisedOn = $this->doneOn->addDays($afterDays);
        $this->delayLabel = Resserrage::delayLabel($afterDays);
        $this->resserrage = ['slug' => $resserrage->slug, 'name' => $resserrage->name, 'price' => $resserrage->price, 'duration_minutes' => $resserrage->duration_minutes];
    }

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return array_values(array_filter([
            self::hasAccount($notifiable) ? 'database' : null,
            $notifiable->routeNotificationFor('mail', $this) ? 'mail' : null,
        ]));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'resserrage',
            'title' => 'Votre resserrage approche',
            'text' => $this->sentence(),
            'url' => $this->bookingPath(),
            'booking_reference' => $this->reference,
            'twist' => $this->twist,
            'done_on' => $this->doneOn->toDateString(),
            'advised_on' => $this->advisedOn->toDateString(),
            'resserrage' => $this->resserrage,
        ];
    }

    /** Exigé par la classe de base ; jamais envoyé (pas de canal SMS dans via()) */
    public function toSms(object $notifiable): SmsMessage
    {
        return new SmsMessage('Dabo Hair : '.$this->sentence());
    }

    public function toMail(object $notifiable): MailMessage
    {
        $price = number_format($this->resserrage['price'], 0, ',', ' ');
        $duration = self::duration($this->resserrage['duration_minutes']);
        // Lien de désinscription : signé (impossible de désinscrire une autre cliente en changeant le numéro)
        $unsubscribe = self::link('rappels/desinscription'.substr(URL::signedRoute('reminders.unsubscribe', ['customer' => $notifiable->getKey()], absolute: false), strlen('/api/v1/reminders/unsubscribe')));

        return $this->mail($notifiable, ($notifiable->first_name ? "{$notifiable->first_name}, v" : 'V').'otre resserrage approche')
            ->line($this->sentence())
            ->line("{$this->resserrage['name']} : **{$duration} · {$price} F**, uniquement sur vos propres cheveux.")
            ->action('Réserver mon resserrage', self::link(ltrim($this->bookingPath(), '/')))
            ->line("Ce rappel est aussi dans votre espace client, rubrique «\u{00A0}Notifications\u{00A0}».")
            ->line("[Ne plus recevoir les rappels de resserrage]({$unsubscribe})");
    }

    private function sentence(): string
    {
        return 'Votre '.Str::lcfirst($this->twist).' a été fait le '.$this->doneOn->locale('fr')->isoFormat('D MMMM')
            .'. Awa conseille un resserrage '.$this->delayLabel.' après, soit vers le '.$this->advisedOn->locale('fr')->isoFormat('D MMMM').'.';
    }

    private function bookingPath(): string
    {
        return '/reserver?prestation='.$this->resserrage['slug'];
    }

    private static function duration(int $minutes): string
    {
        $h = intdiv($minutes, 60);
        $m = $minutes % 60;

        return $m ? "{$h} h {$m}" : "{$h} h";
    }
}
