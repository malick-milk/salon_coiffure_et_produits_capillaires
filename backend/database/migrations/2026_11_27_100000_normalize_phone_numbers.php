<?php

use App\Support\Phone;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * BUG DES DOUBLONS (27 novembre 2026) : « +221771234567 » et « 771234567 » étaient deux numéros différents,
 * donc deux fiches clientes. Phone::normalize retire maintenant l'indicatif ; ici, on remet au même format les
 * numéros déjà enregistrés. Si le numéro court existe déjà (vrai doublon), on ne touche à rien et on le signale
 * dans le journal (storage/logs/laravel.log) : la fusion des deux fiches se décide à la main.
 */
return new class extends Migration
{
    /** Tables et si le numéro doit y être unique */
    private const TABLES = ['users' => true, 'customers' => true, 'addresses' => false, 'pickup_points' => false, 'employees' => false];

    public function up(): void
    {
        foreach (self::TABLES as $table => $unique) {
            DB::table($table)->where(fn ($q) => $q->where('phone', 'like', '+221%')->orWhere('phone', 'like', '00221%')->orWhere('phone', 'like', '221%'))
                ->orderBy('id')->get(['id', 'phone'])->each(function ($row) use ($table, $unique) {
                    $short = Phone::normalize($row->phone);
                    if ($short === $row->phone) {
                        return; // fixe ou numéro non sénégalais : laissé tel quel
                    }
                    if ($unique && DB::table($table)->where('phone', $short)->exists()) {
                        Log::warning("Doublon de téléphone à fusionner à la main : {$table} #{$row->id} ({$row->phone}) et le numéro {$short}.");

                        return;
                    }
                    DB::table($table)->where('id', $row->id)->update(['phone' => $short]);
                });
        }
    }

    public function down(): void
    {
        // Rien à défaire : le format court est le format attendu depuis le début (« 771234567 »)
    }
};
