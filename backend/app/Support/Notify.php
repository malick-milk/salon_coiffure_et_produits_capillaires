<?php

namespace App\Support;

use App\Models\Customer;
use App\Models\PickupPoint;
use Illuminate\Notifications\Notification;
use Throwable;

/**
 * Prévenir une cliente SANS JAMAIS faire échouer l'action métier : si la mise en file échoue
 * (base indisponible, fournisseur en panne en mode synchrone), la réservation reste valide
 * et l'erreur est écrite dans le journal pour être corrigée.
 */
final class Notify
{
    public static function customer(?Customer $customer, Notification $notification): void
    {
        self::send($customer, $notification);
    }

    /** Étape 14 : messages aux points de retrait partenaires */
    public static function partner(?PickupPoint $point, Notification $notification): void
    {
        self::send($point, $notification);
    }

    private static function send(?object $notifiable, Notification $notification): void
    {
        if (! $notifiable) {
            return;
        }
        try {
            $notifiable->notify($notification);
        } catch (Throwable $e) {
            report($e);
        }
    }
}
