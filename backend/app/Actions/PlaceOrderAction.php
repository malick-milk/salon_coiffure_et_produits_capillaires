<?php

namespace App\Actions;

use App\Enums\FulfillmentMethod;
use App\Enums\OrderChannel;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\StockMovementType;
use App\Exceptions\InsufficientStockException;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\Customers\CustomerResolver;
use App\Services\Inventory\StockService;
use App\Services\Support\ReferenceGenerator;
use Illuminate\Support\Facades\DB;

/**
 * PASSER UNE COMMANDE. Spécification : frontend/src/mocks/orders.ts (priceOrder) et ses tests.
 *
 * - RG-COM-04 : les prix viennent de la BASE ; le navigateur n'envoie que des ids et des quantités.
 * - RG-STK-01 : produits VERROUILLÉS, stock vérifié pour TOUTES les lignes avant la moindre écriture.
 * - Tout se fait dans UNE transaction : en cas d'erreur, rien n'est enregistré (ni commande, ni stock).
 */
class PlaceOrderAction
{
    public function __construct(
        private StockService $stock,
        private CustomerResolver $customers,
        private ReferenceGenerator $references,
    ) {}

    /** @param array{items:list<array{product_id:int,quantity:int}>,fulfillment_method:string,delivery_zone_id:?int,customer:array,shipping_address:?array,notes:?string} $data */
    public function execute(array $data, ?User $user): Order
    {
        // Regrouper un produit envoyé deux fois
        $wanted = collect($data['items'])->groupBy('product_id')->map(fn ($lines) => $lines->sum('quantity'));
        $method = FulfillmentMethod::from($data['fulfillment_method']);
        $zone = $method === FulfillmentMethod::Delivery ? DeliveryZone::query()->active()->findOrFail($data['delivery_zone_id']) : null;

        return DB::transaction(function () use ($data, $user, $wanted, $method, $zone) {
            // Verrou sur les produits, toujours dans le même ordre (par id) pour éviter les interblocages
            $products = Product::query()->active()->whereIn('id', $wanted->keys())->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            if ($products->count() !== $wanted->count()) {
                abort(422, 'Un produit du panier n’existe plus ou n’est plus en vente.');
            }

            $conflicts = $wanted->filter(fn ($qty, $id) => $qty > $products[$id]->stock_quantity)
                ->map(fn ($qty, $id) => ['product_id' => (int) $id, 'name' => $products[$id]->displayName(), 'requested' => $qty, 'available' => $products[$id]->stock_quantity])
                ->values()->all();
            if ($conflicts !== []) {
                throw new InsufficientStockException($conflicts);
            }

            $subtotal = $wanted->map(fn ($qty, $id) => $products[$id]->price * $qty)->sum();
            $shippingFee = $zone?->fee ?? 0;
            $address = $method === FulfillmentMethod::Delivery ? $data['shipping_address'] : null;
            $customer = $this->customers->resolve($user, $data['customer']);

            $order = Order::create([
                'reference' => $this->references->next('order', 'CMD'),
                'customer_id' => $customer->id,
                'channel' => OrderChannel::Online,
                'status' => OrderStatus::Pending,
                // Valeurs explicites : après create(), les DEFAULT de la base ne sont pas relus dans l'objet PHP
                'payment_status' => PaymentStatus::Unpaid,
                'fulfillment_method' => $method,
                'delivery_zone_id' => $zone?->id,
                'shipping_name' => $address ? trim($data['customer']['first_name'].' '.$data['customer']['last_name']) : null,
                'shipping_phone' => $address ? $customer->phone : null,
                'shipping_city' => $address['city'] ?? null,
                'shipping_district' => $address['district'] ?? null,
                'shipping_address' => $address['address_line'] ?? null,
                'shipping_landmark' => $address['landmark'] ?? null,
                'subtotal' => $subtotal,
                'discount_total' => 0,
                'shipping_fee' => $shippingFee,
                'total' => $subtotal + $shippingFee, // = sous-total - remise + frais (contrainte CHECK)
                'customer_notes' => $data['notes'] ?? null,
                'placed_at' => now(),
            ]);

            foreach ($wanted as $id => $qty) {
                $product = $products[$id];
                $order->items()->create([
                    'product_id' => $product->id,
                    'product_name' => $product->displayName(), // instantanés (RG-COM-03)
                    'sku' => $product->sku,
                    'unit_price' => $product->price,
                    'unit_cost' => $product->cost_price,
                    'quantity' => $qty,
                    'line_total' => $product->price * $qty,
                ]);
                $this->stock->record($product, StockMovementType::Sale, -$qty, $order, userId: $user?->id);
            }

            return $order->load('items.product', 'deliveryZone');
        });
    }
}
