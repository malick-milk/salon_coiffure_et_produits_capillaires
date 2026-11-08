<?php

namespace App\Notifications;

use App\Models\Setting;
use App\Notifications\Channels\SmsChannel;
use App\Notifications\Channels\SmsMessage;
use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Base des messages envoyés aux clientes (étape 13).
 *
 * - ShouldQueue : le message part en ARRIÈRE-PLAN (file d'attente « database »). La cliente ou le salon
 *   n'attendent pas l'opérateur SMS ; si l'envoi échoue, il est retenté (3 essais) sans rien bloquer.
 * - afterCommit : le message n'est mis en file qu'une fois la transaction validée en base
 *   (pas de SMS pour une réservation finalement annulée par une erreur).
 * - Les canaux dépendent des coordonnées connues : SMS si un mobile sénégalais, e-mail si une adresse.
 */
abstract class CustomerNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var list<int> secondes d'attente entre deux essais */
    public array $backoff = [60, 300];

    public function __construct()
    {
        $this->afterCommit();
    }

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return array_values(array_filter([
            $notifiable->routeNotificationFor('sms', $this) ? SmsChannel::class : null,
            $notifiable->routeNotificationFor('mail', $this) ? 'mail' : null,
        ]));
    }

    abstract public function toSms(object $notifiable): SmsMessage;

    abstract public function toMail(object $notifiable): MailMessage;

    /** E-mail aux couleurs du salon : formule d'appel, signature et coordonnées en français */
    protected function mail(object $notifiable, string $subject): MailMessage
    {
        $phone = $this->salonPhone();

        return (new MailMessage)->subject($subject)
            ->greeting('Bonjour '.($notifiable->first_name ?: '').',')
            ->salutation("À bientôt,\nL’équipe Dabo Hair".($phone ? "\n{$phone}" : ''));
    }

    protected static function when(CarbonInterface $date): string
    {
        return $date->locale('fr')->isoFormat('dddd D MMMM [à] H[h]mm');
    }

    protected static function link(string $path): string
    {
        return config('app.frontend_url').'/'.ltrim($path, '/');
    }

    protected function salonPhone(): ?string
    {
        $phone = (Setting::get('company.identity', []) ?? [])['phone'] ?? null;

        return $phone ?: null;
    }
}
