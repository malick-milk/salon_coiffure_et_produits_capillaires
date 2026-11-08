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

    /** Format international exigé par les fournisseurs de SMS : « 77 123 45 67 » -> « +221771234567 » */
    public static function toE164(?string $phone): ?string
    {
        $p = self::normalize($phone);
        if (preg_match('/^(\+221|00221)?(7[05678]\d{7})$/', $p, $m)) {
            return '+221'.$m[2];
        }

        return null; // numéro absent ou non sénégalais : pas de SMS
    }

    /** « +221771234567 » -> « +22177***4567 » pour les journaux */
    public static function mask(?string $phone): ?string
    {
        return $phone ? mb_substr($phone, 0, 6).'***'.mb_substr($phone, -4) : null;
    }
}
