<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Order;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

/** Facture PDF (EF-CLI-07, EF-COM-07) : générée à la demande à partir des données FIGÉES de la facture */
class InvoiceController extends Controller
{
    /** Client : facture de SA commande (Policy : anti-IDOR) */
    public function forCustomer(string $reference): Response
    {
        $order = Order::query()->where('reference', $reference)->with('customer')->firstOrFail();
        Gate::authorize('view', $order);

        return $this->pdf(Invoice::query()->where('order_id', $order->id)->where('type', 'invoice')->firstOrFail(), $order);
    }

    /** Personnel (permission invoices.view) */
    public function forStaff(string $number): Response
    {
        $invoice = Invoice::query()->where('number', $number)->firstOrFail();

        return $this->pdf($invoice, $invoice->order);
    }

    private function pdf(Invoice $invoice, Order $order): Response
    {
        $order->load(['items', 'payments', 'deliveryZone']);

        return Pdf::loadView('pdf.invoice', ['invoice' => $invoice, 'order' => $order])
            ->setPaper('a4')
            ->download("{$invoice->number}.pdf");
    }
}
