<?php

namespace App\Services\Support;

use Illuminate\Support\Facades\DB;

/** Références lisibles et uniques : ReferenceGenerator::next('order', 'CMD') -> "CMD-2026-000010" */
class ReferenceGenerator
{
    public function next(string $name, string $prefix): string
    {
        return DB::transaction(function () use ($name, $prefix) {
            $year = (int) now()->format('Y');
            DB::table('counters')->insertOrIgnore(['name' => $name, 'year' => $year, 'last_number' => 0]);
            // SELECT … FOR UPDATE : le compteur reste verrouillé jusqu'à la fin de la transaction
            $last = DB::table('counters')->where(['name' => $name, 'year' => $year])->lockForUpdate()->value('last_number');
            DB::table('counters')->where(['name' => $name, 'year' => $year])->update(['last_number' => $last + 1]);

            return sprintf('%s-%d-%06d', $prefix, $year, $last + 1);
        });
    }
}
