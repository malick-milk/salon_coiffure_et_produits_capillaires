<?php

namespace App\Actions\Admin;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\StockMovementType;
use App\Models\Order;
use App\Models\User;
use App\Services\Inventory\StockService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Faire avancer une commande dans son cycle de vie (machine à états de OrderStatus).
 * Annuler une commande REMET les produits en stock (mouvements « sale_cancellation »).
 */
class ChangeOrderStatusAction
{
    public function __construct(private StockService $stock) {}

    public function execute(Order $order, OrderStatus $next, User $by, ?string $reason = null): Order
    {
        if (! $order->status->canTransitionTo($next, $order->fulfillment_method)) {
            throw ValidationException::withMessages(['status' => "Passage impossible de « {$order->status->label()} » à « {$next->label()} »."]);
        }
        if ($next === OrderStatus::Cancelled && $order->payment_status === PaymentStatus::Paid) {
            throw ValidationException::withMessages(['status' => 'Commande déjà payée : il faut d’abord la rembourser (avoir).']);
        }
        if ($next === OrderStatus::Cancelled && blank($reason)) {
            throw ValidationException::withMessages(['reason' => 'Indiquez le motif de l’annulation.']);
        }

        return DB::transaction(function () use ($order, $next, $by, $reason) {
            $order->fill(['status' => $next, ...match ($next) {
                OrderStatus::Confirmed => ['confirmed_at' => now()],
                OrderStatus::Shipped => ['shipped_at' => now()],
                OrderStatus::Delivered => ['delivered_at' => now()],
                OrderStatus::Cancelled => ['cancelled_at' => now(), 'cancellation_reason' => $reason],
                default => [],
            }])->save();

            if ($next === OrderStatus::Cancelled) {
                foreach ($order->items()->with('product')->get() as $item) {
                    $this->stock->record($item->product, StockMovementType::SaleCancellation, $item->quantity, $order, "Annulation {$order->reference}", $by->id);
                }
            }

            return $order;
        });
    }
}
