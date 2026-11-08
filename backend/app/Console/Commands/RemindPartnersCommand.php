<?php

namespace App\Console\Commands;

use App\Models\PickupPoint;
use App\Notifications\PartnerMonthlyReminder;
use App\Support\Notify;
use Illuminate\Console\Command;

/** Le 1er du mois : SMS aux points de retrait (relevé des produits restants, versement avant le 5) */
class RemindPartnersCommand extends Command
{
    protected $signature = 'partners:remind';

    protected $description = 'Rappelle aux points de retrait le relevé mensuel et le versement avant le 5';

    public function handle(): int
    {
        $month = now()->subMonth()->locale('fr')->isoFormat('MMMM YYYY');
        $points = PickupPoint::query()->active()->get();
        foreach ($points as $point) {
            Notify::partner($point, new PartnerMonthlyReminder($month));
        }
        $this->info($points->count().' point(s) de retrait prévenu(s).');

        return self::SUCCESS;
    }
}
