<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/** php artisan migrate:fresh --seed : base complète et cohérente en une commande */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            ReferenceDataSeeder::class,
            DaboHairCatalogSeeder::class,
            DemoAccountsSeeder::class,
            DemoReviewsSeeder::class,
            DemoPickupPointsSeeder::class,
        ]);
    }
}
