<?php

namespace App\Actions\Admin;

use App\Enums\FulfillmentMethod;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\StockMovementType;
use App\Models\Order;
use App\Models\User;
use App\Notifications\PickupOrderReady;
use App\Notifications\PickupOrderToHandOver;
use App\Services\Inventory\StockService;
use App\Services\PickupPoints\PickupPointService;
use App\Support\Notify;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Faire avancer une commande dans son cycle de vie (machine à états de OrderStatus).
 * Annuler une commande REMET les produits en stock (mouvements « sale_cancellation »).
 */
class ChangeOrderStatusAction
{
    public function __construct(private StockService $stock, private PickupPointService $pickupPoints) {}

    /** @param ?User $by null quand le partenaire confirme la remise avec le code de la cliente (étape 14) */
    public function execute(Order $order, OrderStatus $next, ?User $by, ?string $reason = null): Order
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

        $atPoint = $order->fulfillment_method === FulfillmentMethod::PickupPoint;
        $handoverToken = null;

        $order = DB::transaction(function () use ($order, $next, $by, $reason, $atPoint, &$handoverToken) {
            if ($next === OrderStatus::Ready && $atPoint) {
                // Étape 14 : code à 4 chiffres pour la cliente, lien personnel pour le partenaire (seule l'empreinte est stockée)
                $handoverToken = Str::random(40);
                $order->fill(['pickup_code' => str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT), 'handover_token_hash' => hash('sha256', $handoverToken)]);
            }
            $order->fill(['status' => $next, ...match ($next) {
                OrderStatus::Confirmed => ['confirmed_at' => now()],
                OrderStatus::Shipped => ['shipped_at' => now()],
                OrderStatus::Delivered => ['delivered_at' => now(), 'picked_up_at' => $atPoint ? now() : null],
                OrderStatus::Cancelled => ['cancelled_at' => now(), 'cancellation_reason' => $reason],
                default => [],
            }])->save();

            if ($next === OrderStatus::Cancelled && $atPoint) {
                $this->pickupPoints->releaseForCancelledOrder($order, $by?->id); // retour dans le stock du partenaire
            } elseif ($next === OrderStatus::Cancelled) {
                foreach ($order->items()->with('product')->get() as $item) {
                    $this->stock->record($item->product, StockMovementType::SaleCancellation, $item->quantity, $order, "Annulation {$order->reference}", $by?->id);
                }
            }

            return $order;
        });

        if ($handoverToken) {
            $order->loadMissing(['customer', 'pickupPoint', 'items']);
            Notify::customer($order->customer, new PickupOrderReady($order));
            Notify::partner($order->pickupPoint, new PickupOrderToHandOver($order, $handoverToken));
        }

        return $order;
    }
}
