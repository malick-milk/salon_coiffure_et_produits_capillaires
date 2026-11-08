<?php

namespace App\Services\Sms;

use App\Support\Phone;
use Illuminate\Support\Facades\Log;

/** Pilote par défaut : n'envoie rien, écrit le SMS dans storage/logs/sms-AAAA-MM-JJ.log (numéro masqué) */
final class LogSmsSender implements SmsSender
{
    public function send(string $to, string $text): void
    {
        Log::channel('sms')->info('SMS', ['to' => Phone::mask($to), 'sender' => config('services.sms.sender'), 'text' => $text]);
    }
}
