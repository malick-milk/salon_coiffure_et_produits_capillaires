<?php

namespace App\Support;

use App\Models\Customer;
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
        if (! $customer) {
            return;
        }
        try {
            $customer->notify($notification);
        } catch (Throwable $e) {
            report($e);
        }
    }
}
