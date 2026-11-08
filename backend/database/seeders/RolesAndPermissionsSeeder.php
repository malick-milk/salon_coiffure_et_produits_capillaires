<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/** Rôles et permissions (RBAC, ADR-004). Le code vérifie des PERMISSIONS, jamais des noms de rôle. */
class RolesAndPermissionsSeeder extends Seeder
{
    public const PERMISSIONS = [
        'products.view', 'products.manage', 'stock.view', 'stock.adjust', 'production.manage',
        'orders.view', 'orders.manage', 'bookings.view', 'bookings.manage', 'customers.view', 'customers.manage',
        'invoices.view', 'invoices.manage', 'analytics.view', 'users.manage', 'roles.manage', 'settings.manage', 'audit.view',
        'reviews.manage', // étape 13 : avis clients et satisfaction
    ];

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (self::PERMISSIONS as $name) {
            Permission::findOrCreate($name, 'web');
        }

        $roles = [
            'super_admin' => self::PERMISSIONS, // propriétaire : tout
            'manager' => array_values(array_diff(self::PERMISSIONS, ['analytics.view', 'users.manage', 'roles.manage', 'audit.view'])),
            'cashier' => ['products.view', 'stock.view', 'orders.view', 'orders.manage', 'customers.view', 'invoices.view'],
            'stylist' => ['bookings.view'],
            'stock_keeper' => ['products.view', 'stock.view', 'stock.adjust', 'production.manage'],
            'customer' => [],
        ];
        foreach ($roles as $role => $permissions) {
            Role::findOrCreate($role, 'web')->syncPermissions($permissions);
        }
    }
}
