<?php

namespace App\Notifications\Channels;

use App\Services\Sms\SmsSender;
use Illuminate\Notifications\Notification;

/** Canal « sms » des notifications Laravel : $notifiable->routeNotificationFor('sms') donne le numéro */
final class SmsChannel
{
    public function __construct(private SmsSender $sender) {}

    public function send(object $notifiable, Notification $notification): void
    {
        $to = $notifiable->routeNotificationFor('sms', $notification);
        if (! $to || ! method_exists($notification, 'toSms')) {
            return;
        }
        $this->sender->send($to, $notification->toSms($notifiable)->text);
    }
}
