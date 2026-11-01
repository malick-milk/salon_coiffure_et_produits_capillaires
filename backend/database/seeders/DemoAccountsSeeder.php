<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Comptes de DÉMONSTRATION — uniquement en local et en test (jamais en production).
 * En production, le compte administrateur est créé par une commande dédiée (étape 11).
 */
class DemoAccountsSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            return;
        }

        $admin = User::updateOrCreate(['email' => 'admin@dabohair.test'], [
            'first_name' => 'Awa', 'last_name' => 'Ndiaye', 'phone' => '770000001', 'password' => 'admin-dabo-2026',
        ]);
        $admin->syncRoles(['super_admin']);

        $client = User::updateOrCreate(['email' => 'mariama@client.test'], [
            'first_name' => 'Mariama', 'last_name' => 'Sow', 'phone' => '770000003', 'password' => 'demo-dabo-2026',
        ]);
        $client->syncRoles(['customer']);
        Customer::updateOrCreate(['phone' => '770000003'], ['user_id' => $client->id, 'first_name' => 'Mariama', 'last_name' => 'Sow', 'email' => 'mariama@client.test']);
    }
}
