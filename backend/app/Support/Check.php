<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Contraintes CHECK de MySQL (règles de gestion protégées par la base, DATABASE.md §1.5).
 * Le constructeur de schéma de Laravel ne sait pas les écrire : on passe par du SQL.
 */
final class Check
{
    public static function add(string $table, string $name, string $expression): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return; // autres moteurs (SQLite…) : la règle reste appliquée par l'application
        }
        DB::statement("ALTER TABLE `{$table}` ADD CONSTRAINT `{$name}` CHECK ({$expression})");
    }

    public static function drop(string $table, string $name): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        DB::statement("ALTER TABLE `{$table}` DROP CHECK `{$name}`");
    }
}
