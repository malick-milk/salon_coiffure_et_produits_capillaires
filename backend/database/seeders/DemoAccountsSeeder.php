<?php

namespace Database\Seeders;

use App\Enums\BookingStatus;
use App\Enums\FulfillmentMethod;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Product;
use App\Models\Service;
use App\Models\Stylist;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Comptes et historique de DÉMONSTRATION — uniquement en local et en test (jamais en production).
 * Identiques au faux serveur du frontend (frontend/src/mocks/db.ts), dates relatives à aujourd'hui.
 * En production, le compte administrateur est créé par une commande dédiée (étape 11).
 */
class DemoAccountsSeeder extends Seeder
{
    public function run(): void
    {
        // Compteurs de références : CMD-2026-000009 existe déjà (vente en gros)
        DB::table('counters')->insertOrIgnore([
            ['name' => 'order', 'year' => (int) now()->format('Y'), 'last_number' => 9],
            ['name' => 'booking', 'year' => (int) now()->format('Y'), 'last_number' => 10],
        ]);

        if (! app()->environment(['local', 'testing'])) {
            return;
        }

        $admin = User::updateOrCreate(['email' => 'admin@dabohair.test'], [
            'first_name' => 'Awa', 'last_name' => 'Ndiaye', 'phone' => '770000001', 'password' => 'admin-dabo-2026',
        ]);
        $admin->syncRoles(['super_admin']);

        $user = User::updateOrCreate(['email' => 'mariama@client.test'], [
            'first_name' => 'Mariama', 'last_name' => 'Sow', 'phone' => '770000003', 'password' => 'demo-dabo-2026',
        ]);
        $user->syncRoles(['customer']);
        $mariama = Customer::updateOrCreate(['phone' => '770000003'], ['user_id' => $user->id, 'first_name' => 'Mariama', 'last_name' => 'Sow', 'email' => 'mariama@client.test']);

        if ($mariama->orders()->exists()) {
            return;
        }

        // Historique : prix FIGÉS dans les lignes (ces ventes passées n'affectent pas le stock actuel)
        $serum = Product::where('sku', 'DAB-SAP-030')->first();
        $spray = Product::where('sku', 'DAB-SPH-250')->first();
        $creme = Product::where('sku', 'DAB-CRE-001')->first();
        $delivered = Order::create([
            'reference' => 'CMD-2026-000101', 'customer_id' => $mariama->id, 'status' => OrderStatus::Delivered, 'payment_status' => PaymentStatus::Paid,
            'fulfillment_method' => FulfillmentMethod::Delivery, 'delivery_zone_id' => DeliveryZone::where('name', 'Dakar Plateau')->value('id'),
            'shipping_name' => 'Mariama Sow', 'shipping_phone' => '770000003', 'shipping_city' => 'Dakar', 'shipping_district' => 'Plateau',
            'shipping_address' => 'Rue 10', 'shipping_landmark' => 'Près de la pharmacie',
            'subtotal' => 11000, 'shipping_fee' => 1000, 'total' => 12000,
            'placed_at' => now()->subDays(25)->setTime(10, 15), 'paid_at' => now()->subDays(24), 'delivered_at' => now()->subDays(24),
        ]);
        foreach ([[$serum, 2], [$spray, 1]] as [$p, $q]) {
            $delivered->items()->create(['product_id' => $p->id, 'product_name' => $p->displayName(), 'sku' => $p->sku, 'unit_price' => $p->price, 'unit_cost' => $p->cost_price, 'quantity' => $q, 'line_total' => $p->price * $q]);
        }
        $pending = Order::create([
            'reference' => 'CMD-2026-000102', 'customer_id' => $mariama->id, 'status' => OrderStatus::Confirmed,
            'fulfillment_method' => FulfillmentMethod::Pickup, 'subtotal' => 6000, 'total' => 6000, 'placed_at' => now()->subDays(2)->setTime(18, 20),
        ]);
        $pending->items()->create(['product_id' => $creme->id, 'product_name' => $creme->displayName(), 'sku' => $creme->sku, 'unit_price' => 3000, 'unit_cost' => $creme->cost_price, 'quantity' => 2, 'line_total' => 6000]);

        $stylist = Stylist::where('display_name', ReferenceDataSeeder::STYLIST_NAME)->value('id');
        foreach ([
            ['RDV-2026-000201', BookingStatus::Confirmed, 'micro-twist-long', now()->addDays(10)->setTime(10, 0)],
            ['RDV-2026-000105', BookingStatus::Completed, 'twist-simple', now()->subDays(30)->setTime(16, 0)],
        ] as [$reference, $status, $slug, $start]) {
            $service = Service::where('slug', $slug)->first();
            Booking::create([
                'reference' => $reference, 'customer_id' => $mariama->id, 'service_id' => $service->id, 'stylist_id' => $stylist,
                'status' => $status, 'starts_at' => $start, 'ends_at' => $start->copy()->addMinutes($service->duration_minutes + $service->buffer_minutes),
                'service_name' => $service->name, 'duration_minutes' => $service->duration_minutes, 'price' => $service->price,
            ]);
        }
    }
}
