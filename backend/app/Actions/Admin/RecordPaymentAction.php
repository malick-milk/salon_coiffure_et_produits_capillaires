<?php

namespace App\Actions\Admin;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Encaisser une commande (paiement à la réception : espèces, Wave, Orange Money, Free Money, carte).
 * Passerelle « manual » aujourd'hui ; Wave & co. s'ajouteront comme d'autres passerelles (ADR-007).
 * Le paiement déclenche l'émission de la facture (RG-FAC-01), dans la même transaction.
 */
class RecordPaymentAction
{
    public function __construct(private IssueInvoiceAction $issueInvoice) {}

    public function execute(Order $order, PaymentMethod $method, User $by, ?string $providerReference = null): Payment
    {
        if ($order->payment_status === PaymentStatus::Paid) {
            throw ValidationException::withMessages(['order' => 'Cette commande est déjà payée.']);
        }
        if ($order->status === OrderStatus::Cancelled) {
            throw ValidationException::withMessages(['order' => 'Une commande annulée ne peut pas être encaissée.']);
        }

        return DB::transaction(function () use ($order, $method, $by, $providerReference) {
            $payment = $order->payments()->create([
                'gateway' => 'manual',
                'method' => $method,
                'amount' => $order->total, // le montant vient de la COMMANDE, jamais d'une saisie
                'status' => 'succeeded',
                'provider_reference' => $providerReference,
                'recorded_by' => $by->id,
                'paid_at' => now(),
            ]);
            $order->update(['payment_status' => PaymentStatus::Paid, 'paid_at' => now()]);
            $this->issueInvoice->execute($order);

            return $payment;
        });
    }
}
