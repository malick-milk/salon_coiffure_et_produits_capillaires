<?php

namespace App\Console\Commands;

use App\Models\Setting;
use Illuminate\Console\Command;

/**
 * Identité légale de l'entreprise, imprimée sur chaque facture (obligation légale au Sénégal).
 *   php artisan app:company                       -> affiche les valeurs actuelles
 *   php artisan app:company --ninea=00123456 --rccm="SN-DKR-2026-A-12345" --address="Dakar, Sénégal" --phone="77 123 45 67"
 * Les factures déjà émises gardent les valeurs du jour de leur émission (instantané, comme les prix).
 */
class CompanyIdentityCommand extends Command
{
    protected $signature = 'app:company {--name=} {--ninea=} {--rccm=} {--address=} {--phone=}';

    protected $description = 'Affiche ou modifie l’identité légale de l’entreprise (factures)';

    public function handle(): int
    {
        $setting = Setting::firstOrCreate(['key' => 'company.identity'], ['group' => 'company', 'value' => ['name' => config('app.name')]]);
        $identity = (array) $setting->value;
        $changes = array_filter([
            'name' => $this->option('name'), 'ninea' => $this->option('ninea'), 'rccm' => $this->option('rccm'),
            'address' => $this->option('address'), 'phone' => $this->option('phone'),
        ], fn ($v) => $v !== null && trim($v) !== '');

        if ($changes) {
            $setting->update(['value' => [...$identity, ...array_map('trim', $changes)]]);
            $identity = (array) $setting->fresh()->value;
            $this->info('Identité mise à jour : les PROCHAINES factures l’utiliseront.');
        }
        foreach (['name' => 'Raison sociale', 'ninea' => 'NINEA', 'rccm' => 'RCCM', 'address' => 'Adresse', 'phone' => 'Téléphone'] as $key => $label) {
            $value = $identity[$key] ?? '—';
            $this->line(sprintf('  %-15s %s', $label, str_contains((string) $value, 'RENSEIGNER') ? "<fg=yellow>{$value}</>" : $value));
        }

        return self::SUCCESS;
    }
}
