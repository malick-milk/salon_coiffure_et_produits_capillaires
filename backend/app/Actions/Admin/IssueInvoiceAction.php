<?php

namespace App\Actions\Admin;

use App\Models\Invoice;
use App\Models\Order;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;

/**
 * Émettre la facture d'une commande payée (RG-FAC-01 à 04).
 * Numérotation SANS TROU : compteur invoice_sequences verrouillé dans la transaction de l'appelant ;
 * si l'émission échoue, le ROLLBACK annule aussi l'incrément (DATABASE.md §6.4).
 */
class IssueInvoiceAction
{
    public function execute(Order $order): Invoice
    {
        if ($existing = Invoice::query()->where('order_id', $order->id)->where('type', 'invoice')->first()) {
            return $existing; // une seule facture par commande
        }

        return DB::transaction(function () use ($order) {
            $year = (int) now()->format('Y');
            DB::table('invoice_sequences')->insertOrIgnore(['year' => $year, 'type' => 'invoice', 'last_number' => 0]);
            $last = DB::table('invoice_sequences')->where(['year' => $year, 'type' => 'invoice'])->lockForUpdate()->value('last_number');
            DB::table('invoice_sequences')->where(['year' => $year, 'type' => 'invoice'])->update(['last_number' => $last + 1]);

            $customer = $order->customer;

            return Invoice::create([
                'number' => sprintf('FAC-%d-%06d', $year, $last + 1),
                'type' => 'invoice',
                'order_id' => $order->id,
                'customer_id' => $customer->id,
                // INSTANTANÉS : la facture reste identique même si le client ou l'entreprise changent ensuite
                'customer_name' => $customer->fullName(),
                'customer_phone' => $customer->phone,
                'customer_email' => $customer->email,
                'billing_address' => $order->shipping_address ? collect([$order->shipping_address, $order->shipping_district, $order->shipping_city])->filter()->implode(', ') : null,
                'company_snapshot' => Setting::get('company.identity', ['name' => config('app.name')]),
                'subtotal' => $order->subtotal + $order->shipping_fee - $order->discount_total,
                'tax_total' => $order->tax_total,
                'total' => $order->total,
                'issued_at' => now(),
            ]);
        });
    }
}
