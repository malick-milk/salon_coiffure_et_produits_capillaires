<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Admin\ChangeOrderStatusAction;
use App\Enums\FulfillmentMethod;
use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PickupPoint;
use App\Support\SecurityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

/** Étape 14 : points de retrait, côté public (choix au panier) et côté partenaire (remise avec le code) */
class PickupPointController extends Controller
{
    /** Points actifs, pour le choix « Retrait dans une boutique partenaire de votre région » */
    public function index(): JsonResponse
    {
        return response()->json(['data' => PickupPoint::query()->active()->orderBy('city')->get()->map(fn (PickupPoint $p) => [
            'id' => $p->id, 'name' => $p->name, 'regions' => $p->regions, 'city' => $p->city,
            'address' => $p->address, 'opening_hours' => $p->opening_hours,
        ])]);
    }

    /** Page du partenaire, ouverte depuis le lien reçu par SMS (pas de compte : le lien suffit) */
    public function handover(string $token): JsonResponse
    {
        $order = $this->find($token);

        return response()->json(['data' => [
            'reference' => $order->reference,
            'pickup_point' => $order->pickupPoint->name,
            'customer_first_name' => $order->customer->first_name,
            'items' => $order->items->map(fn ($i) => ['name' => $i->product_name, 'quantity' => $i->quantity])->values(),
            'total' => $order->total,
            'state' => match ($order->status) {
                OrderStatus::Ready => 'ready', OrderStatus::Delivered => 'handed_over', default => 'unavailable',
            },
        ]]);
    }

    /** Le partenaire saisit le code donné par la cliente : 5 essais par quart d'heure, puis blocage */
    public function confirmHandover(Request $request, string $token, ChangeOrderStatusAction $change): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'digits:4']]);
        $order = $this->find($token);
        abort_unless($order->status === OrderStatus::Ready, 409, $order->status === OrderStatus::Delivered ? 'Cette commande a déjà été remise.' : 'Cette commande n’est pas à remettre.');

        $key = 'handover:'.$order->id;
        abort_if(RateLimiter::tooManyAttempts($key, 5), 429, 'Trop de codes erronés. Réessayez dans 15 minutes ou appelez Dabo Hair.');
        if (! hash_equals((string) $order->pickup_code, $data['code'])) {
            RateLimiter::hit($key, 900);
            SecurityLog::event('handover.wrong_code', $request, ['order' => $order->reference]);

            return response()->json(['message' => 'Code incorrect. Demandez à la cliente le code reçu par SMS.', 'errors' => ['code' => ['Code incorrect.']]], 422);
        }
        RateLimiter::clear($key);
        $change->execute($order, OrderStatus::Delivered, null);

        return response()->json(['data' => ['state' => 'handed_over', 'total' => $order->total]]);
    }

    private function find(string $token): Order
    {
        $order = Order::query()->with(['pickupPoint', 'customer', 'items'])->where('handover_token_hash', hash('sha256', $token))
            ->where('fulfillment_method', FulfillmentMethod::PickupPoint)->first();
        abort_unless($order, 404, 'Lien de remise introuvable.');

        return $order;
    }
}
