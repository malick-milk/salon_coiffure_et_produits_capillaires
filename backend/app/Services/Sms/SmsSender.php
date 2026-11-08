<?php

namespace App\Services\Sms;

/**
 * Contrat d'un fournisseur de SMS. Le reste du code ne connaît que cette interface :
 * changer de fournisseur = écrire une classe de plus et changer SMS_DRIVER, sans toucher aux notifications.
 */
interface SmsSender
{
    /** @param string $to numéro au format international (+221…) */
    public function send(string $to, string $text): void;
}
