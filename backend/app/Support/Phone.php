<?php

namespace App\Support;

/** Téléphones sénégalais : on stocke une forme normalisée (sans espaces ni points) */
final class Phone
{
    /** Mobile : 70, 75, 76, 77 ou 78 + 7 chiffres, avec ou sans +221 */
    public const SENEGAL_MOBILE = '/^(\+221)?7[05678]\d{7}$/';

    public static function normalize(?string $phone): string
    {
        return preg_replace('/[\s.\-]/', '', (string) $phone);
    }
}
