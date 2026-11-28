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
use App\Models\PickupPoint;
use App\Models\Product;
use App\Models\ProductBundleItem;
use App\Models\Setting;
use App\Models\User;
use App\Services\Catalog\MemberPriceService;
use App\Services\Catalog\PromotionService;
use App\Services\Customers\CustomerResolver;
use App\Services\Customers\MarketingConsent;
use App\Services\Inventory\StockService;
use App\Services\PickupPoints\PickupPointService;
use App\Services\Support\ReferenceGenerator;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
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
        private PickupPointService $pickupPoints,
        private MemberPriceService $memberPrices,
        private PromotionService $promotions,
    ) {}

    /** @param array{items:list<array{product_id:int,quantity:int}>,fulfillment_method:string,delivery_zone_id:?int,pickup_point_id?:?int,customer:array,shipping_address:?array,notes:?string,marketing_consent?:bool} $data */
    public function execute(array $data, ?User $user): Order
    {
        // Regrouper un produit envoyé deux fois
        $wanted = collect($data['items'])->groupBy('product_id')->map(fn ($lines) => $lines->sum('quantity'));
        $method = FulfillmentMethod::from($data['fulfillment_method']);
        $zone = $method === FulfillmentMethod::Delivery ? DeliveryZone::query()->active()->findOrFail($data['delivery_zone_id']) : null;
        // Étape 14 : retrait dans une boutique partenaire, servi depuis le stock confié à ce partenaire
        $point = $method === FulfillmentMethod::PickupPoint ? PickupPoint::query()->active()->findOrFail($data['pickup_point_id']) : null;

        // Gammes : leurs composants seront verrouillés et retirés du stock avec elles
        // toBase() : le regroupement devient une collection ordinaire (une collection Eloquent ne contient que des modèles)
        $components = ProductBundleItem::query()->whereIn('bundle_id', $wanted->keys())->get()->groupBy('bundle_id')->toBase();
        if ($point && $components->isNotEmpty()) {
            abort(422, 'La gamme se retire au salon ou se fait livrer : elle n’est pas disponible en point de retrait.');
        }

        return DB::transaction(function () use ($data, $user, $wanted, $method, $zone, $point, $components) {
            // Verrou sur les produits ET les composants des gammes, toujours dans le même ordre (par id) pour éviter les interblocages
            $ids = $wanted->keys()->merge($components->flatten()->pluck('component_id'))->unique()->sort()->values();
            $locked = Product::query()->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            // filter() et non only() : sur une collection Eloquent, only() renumérote les clés (0, 1…) au lieu de garder les ids
            $products = $locked->filter(fn (Product $p, int $id) => $wanted->has($id) && $p->is_active);
            if ($products->count() !== $wanted->count()) {
                abort(422, 'Un produit du panier n’existe plus ou n’est plus en vente.');
            }

            $conflicts = $point ? [] : $this->conflicts($wanted, $products, $locked, $components);
            if ($conflicts !== []) {
                throw new InsufficientStockException($conflicts);
            }

            // Lignes facturées : une gamme au prix membre (si la cliente y a droit) puis le reste au prix normal
            $lines = $this->priceLines($wanted, $products, $locked, $components, $user);

            $subtotal = collect($lines)->sum(fn ($l) => $l['unit_price'] * $l['quantity']);
            // « ?? » couvre aussi $zone = null (retrait). Livraison offerte au-delà du seuil réglé dans l'ERP (21 novembre 2026)
            $threshold = Setting::freeDeliveryThreshold();
            $shippingFee = $threshold !== null && $subtotal >= $threshold ? 0 : ($zone->fee ?? 0);
            $address = $method === FulfillmentMethod::Delivery ? $data['shipping_address'] : null;
            $customer = $this->customers->resolve($user, $data['customer']);
            // Case cochée : accord ; non cochée : rien ne change. Sans connexion, seulement pour une fiche NOUVELLE :
            // sinon n'importe qui taperait le numéro d'une cliente et l'abonnerait à sa place (bug QA du 28 novembre 2026)
            if (! empty($data['marketing_consent']) && ($user !== null || $customer->wasRecentlyCreated)) {
                MarketingConsent::record($customer, true, 'order');
            }

            $order = Order::create([
                'reference' => $this->references->next('order', 'CMD'),
                'customer_id' => $customer->id,
                'channel' => OrderChannel::Online,
                'status' => OrderStatus::Pending,
                // Valeurs explicites : après create(), les DEFAULT de la base ne sont pas relus dans l'objet PHP
                'payment_status' => PaymentStatus::Unpaid,
                'fulfillment_method' => $method,
                'delivery_zone_id' => $zone?->id,
                'pickup_point_id' => $point?->id,
                'shipping_name' => $address ? trim($data['customer']['first_name'].' '.$data['customer']['last_name']) : null,
                'shipping_phone' => $address ? $customer->phone : null,
                'shipping_city' => $address['city'] ?? null,
                'shipping_district' => $address['district'] ?? null,
                'shipping_address' => $address['address_line'] ?? null,
                'shipping_landmark' => $address['landmark'] ?? null,
                'subtotal' => $subtotal,
                'discount_total' => 0,
                'tax_rate' => 0, // pas de TVA facturée pour l'instant ; explicite, sinon la facture lirait null
                'tax_total' => 0,
                'shipping_fee' => $shippingFee,
                'total' => $subtotal + $shippingFee, // = sous-total - remise + frais (contrainte CHECK)
                'customer_notes' => $data['notes'] ?? null,
                'placed_at' => now(),
            ]);

            foreach ($lines as $line) {
                $product = $line['product'];
                $order->items()->create([
                    'product_id' => $product->id,
                    'product_name' => $product->displayName(), // instantanés (RG-COM-03)
                    'sku' => $product->sku,
                    'unit_price' => $line['unit_price'],
                    'regular_unit_price' => $line['regular_unit_price'],
                    'promotion_id' => $line['promotion_id'],
                    'unit_cost' => $line['unit_cost'],
                    'quantity' => $line['quantity'],
                    'line_total' => $line['unit_price'] * $line['quantity'],
                ]);
            }
            if (! $point) {
                foreach ($wanted as $id => $qty) {
                    $product = $products[$id];
                    if (! $product->is_bundle) {
                        $this->stock->record($product, StockMovementType::Sale, -$qty, $order, userId: $user?->id);

                        continue;
                    }
                    // Une gamme vendue = ses composants sortent du stock (le grand livre dit pourquoi)
                    foreach ($components[$id] as $item) {
                        $this->stock->record($locked[$item->component_id], StockMovementType::Sale, -$qty * $item->quantity, $order, 'Vente de '.$product->displayName(), $user?->id);
                    }
                }
            }
            if ($point) {
                $this->pickupPoints->reserveForOrder($point, $order, $wanted, $products); // refusé si le partenaire n'en a pas assez
            }

            return $order->load('items.product', 'deliveryZone', 'pickupPoint');
        });
    }

    /**
     * Stock insuffisant ? Les produits commandés seuls sont servis d'abord ; une gamme prend ce qui reste
     * de chacun de ses composants. Réponse dans l'ordre du panier (format InsufficientStockException).
     *
     * @param  Collection<int|string, int>  $wanted
     * @param  Collection<int|string, Product>  $products
     * @param  Collection<int|string, Product>  $locked
     * @param  Collection<int|string, EloquentCollection<int, ProductBundleItem>>  $components
     * @return list<array{product_id:int,name:string,requested:int,available:int}>
     */
    private function conflicts(Collection $wanted, Collection $products, Collection $locked, Collection $components): array
    {
        $out = [];
        foreach ($wanted as $id => $qty) {
            $product = $products[$id];
            $available = $product->is_bundle
                ? (int) $components[$id]->map(fn (ProductBundleItem $i) => intdiv(max(0, $locked[$i->component_id]->stock_quantity - ($wanted[$i->component_id] ?? 0)), $i->quantity))->min()
                : $product->stock_quantity;
            if ($qty > $available) {
                $out[] = ['product_id' => (int) $id, 'name' => $product->displayName(), 'requested' => $qty, 'available' => max(0, $available)];
            }
        }

        return $out;
    }

    /**
     * @param  Collection<int|string, int>  $wanted
     * @param  Collection<int|string, Product>  $products
     * @param  Collection<int|string, Product>  $locked
     * @param  Collection<int|string, EloquentCollection<int, ProductBundleItem>>  $components
     * @return list<array{product:Product,quantity:int,unit_price:int,regular_unit_price:?int,promotion_id:?int,unit_cost:?string}>
     */
    private function priceLines(Collection $wanted, Collection $products, Collection $locked, Collection $components, ?User $user): array
    {
        $lines = [];
        foreach ($wanted as $id => $qty) {
            $product = $products[$id];
            // Coût d'une gamme = somme des coûts de ses composants (inconnu si l'un d'eux l'est)
            $cost = $product->cost_price;
            if ($product->is_bundle) {
                $costs = $components[$id]->map(fn (ProductBundleItem $i) => $locked[$i->component_id]->cost_price === null ? null : (float) $locked[$i->component_id]->cost_price * $i->quantity);
                $cost = $costs->contains(null) ? null : number_format((float) $costs->sum(), 2, '.', '');
            }
            // Le produit est verrouillé : deux commandes simultanées ne peuvent pas prendre la même place
            if ($this->memberPrices->status($user, $product) === 'eligible') {
                $lines[] = ['product' => $product, 'quantity' => 1, 'unit_price' => (int) $product->member_price, 'regular_unit_price' => $product->price, 'promotion_id' => null, 'unit_cost' => $cost];
                $qty--;
            }
            if ($qty > 0) {
                // Promotion en cours (maquettes du 20 novembre 2026) : prix promo, le prix initial reste noté sur la ligne
                $promotion = $this->promotions->applicable($product, $user);
                $lines[] = $promotion
                    ? ['product' => $product, 'quantity' => $qty, 'unit_price' => PromotionService::discounted($product->price, $promotion->percent), 'regular_unit_price' => $product->price, 'promotion_id' => $promotion->id, 'unit_cost' => $cost]
                    : ['product' => $product, 'quantity' => $qty, 'unit_price' => $product->price, 'regular_unit_price' => null, 'promotion_id' => null, 'unit_cost' => $cost];
            }
        }

        return $lines;
    }
}
