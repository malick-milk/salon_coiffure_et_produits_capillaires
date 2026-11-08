<?php

namespace App\Notifications\Channels;

/** Un SMS : 160 caractères = 1 SMS facturé ; au-delà, le message est découpé et coûte plus cher */
final class SmsMessage
{
    public function __construct(public readonly string $text) {}
}
