<?php

namespace App\Enums;

/**
 * Ajoute ::values() aux Enums : la liste des valeurs sert à la fois
 * aux migrations (colonnes ENUM) et aux règles de validation.
 */
trait HasValues
{
    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
