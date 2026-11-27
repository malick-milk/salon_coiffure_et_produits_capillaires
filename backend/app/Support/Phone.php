<?php

namespace App\Support;

/**
 * Téléphones sénégalais : on stocke UNE forme normalisée, « 771234567 » (9 chiffres, sans indicatif).
 * Bug du 27 novembre 2026 : « +221 77 123 45 67 » était gardé tel quel (« +221771234567 ») et créait une
 * DEUXIÈME fiche cliente à côté de « 771234567 ». L'indicatif +221 (ou 00221) d'un mobile est donc retiré.
 */
final class Phone
{
    /** Mobile : 70, 75, 76, 77 ou 78 + 7 chiffres, avec ou sans +221 */
    public const SENEGAL_MOBILE = '/^(\+221)?7[05678]\d{7}$/';

    public static function normalize(?string $phone): string
    {
        $p = preg_replace('/[\s.\-()]/', '', (string) $phone) ?? '';

        // Mobile sénégalais avec indicatif : on garde les 9 chiffres (un seul format en base, donc pas de doublon)
        return preg_match('/^(?:\+221|00221|221)(7[05678]\d{7})$/', $p, $m) ? $m[1] : $p;
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
