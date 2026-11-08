<?php

namespace App\Services\PickupPoints;

use App\Actions\Admin\RecordPaymentAction;
use App\Enums\CustomerType;
use App\Enums\FulfillmentMethod;
use App\Enums\OrderChannel;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\StockMovementType;
use App\Exceptions\InsufficientStockException;
use App\Models\ConsignmentDelivery;
use App\Models\ConsignmentStatement;
use App\Models\Customer;
use App\Models\Order;
use App\Models\PickupPoint;
use App\Models\Product;
use App\Models\User;
use App\Services\Inventory\StockService;
use App\Services\Support\ReferenceGenerator;
use App\Support\Phone;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Points de retrait partenaires (étape 14) : tout ce qui touche au stock confié passe par ici.
 *
 * Le stock « attendu » d'un partenaire = livraisons − commandes en ligne remises.
 * À la fin du mois, on compte ce qui reste dans la boutique :
 *   ventes au comptoir = attendu − compté − abîmés.
 * Les commandes en ligne remises ont été encaissées par le partenaire : il les reverse aussi.
 */
class PickupPointService
{
    public function __construct(
        private StockService $stock,
        private ReferenceGenerator $references,
        private RecordPaymentAction $recordPayment,
    ) {}

    // ---------- Livraison mensuelle : bon de dépôt ----------

    /** @param array<int,int> $lines [product_id => quantité] */
    public function deliver(PickupPoint $point, array $lines, User $by, ?string $deliveredOn = null): ConsignmentDelivery
    {
        $lines = array_filter($lines, fn ($qty) => $qty > 0);
        if ($lines === []) {
            throw ValidationException::withMessages(['items' => 'Indiquez au moins un produit à livrer.']);
        }

        return DB::transaction(function () use ($point, $lines, $by, $deliveredOn) {
            $products = Product::query()->whereIn('id', array_keys($lines))->orderBy('id')->get()->keyBy('id');
            $delivery = ConsignmentDelivery::create([
                'number' => $this->references->next('consignment', 'BD'),
                'pickup_point_id' => $point->id,
                'delivered_on' => $deliveredOn ?? now()->toDateString(),
                'total_quantity' => array_sum($lines),
                'total_value' => collect($lines)->map(fn ($qty, $id) => $products[$id]->price * $qty)->sum(),
                'created_by' => $by->id,
            ]);
            foreach ($lines as $id => $qty) {
                $product = $products[$id];
                $delivery->items()->create([
                    'product_id' => $id, 'product_name' => $product->displayName(), 'unit_price' => $product->price,
                    'quantity' => $qty, 'line_total' => $product->price * $qty,
                ]);
                // Sortie du stock principal (refusée si le stock manque) puis entrée chez le partenaire
                $this->stock->record($product, StockMovementType::ConsignmentOut, -$qty, $delivery, "Dépôt {$point->name}", $by->id);
                $this->move($point, $product, $qty, 'delivery', $delivery, $by->id);
            }

            return $delivery->load('items');
        });
    }

    // ---------- Commandes en ligne à retirer chez le partenaire ----------

    /**
     * Réserver dans le stock du partenaire (appelé DANS la transaction de PlaceOrderAction).
     *
     * @param  Collection<int,int>  $wanted  [product_id => quantité]
     * @param  Collection<int,Product>  $products
     */
    public function reserveForOrder(PickupPoint $point, Order $order, Collection $wanted, Collection $products): void
    {
        $stocks = DB::table('pickup_point_stocks')->where('pickup_point_id', $point->id)->whereIn('product_id', $wanted->keys())
            ->orderBy('product_id')->lockForUpdate()->pluck('quantity', 'product_id');
        $conflicts = $wanted->filter(fn ($qty, $id) => $qty > (int) ($stocks[$id] ?? 0))
            ->map(fn ($qty, $id) => ['product_id' => (int) $id, 'name' => $products[$id]->displayName(), 'requested' => $qty, 'available' => (int) ($stocks[$id] ?? 0)])
            ->values()->all();
        if ($conflicts !== []) {
            throw new InsufficientStockException($conflicts);
        }
        foreach ($wanted as $id => $qty) {
            $this->move($point, $products[$id], -$qty, 'online_order', $order);
        }
    }

    /** Commande annulée : les produits reviennent dans le stock du partenaire (pas dans le stock principal) */
    public function releaseForCancelledOrder(Order $order, ?int $userId): void
    {
        $point = PickupPoint::findOrFail($order->pickup_point_id);
        foreach ($order->items()->with('product')->get() as $item) {
            $this->move($point, $item->product, $item->quantity, 'online_order_cancelled', $order, $userId);
        }
    }

    // ---------- Relevé de fin de mois ----------

    /**
     * Calcul du relevé, sans rien enregistrer : sert à l'aperçu de l'ERP ET à la validation.
     *
     * @param  array<int,array{counted:int,damaged?:int}>  $counts  [product_id => comptage]
     * @return array{lines:list<array<string,mixed>>,totals:array<string,int|float>,online_order_ids:list<int>}
     */
    public function compute(PickupPoint $point, array $counts, bool $lock = false): array
    {
        $stockQuery = DB::table('pickup_point_stocks')->where('pickup_point_id', $point->id)->orderBy('product_id');
        $expected = ($lock ? $stockQuery->lockForUpdate() : $stockQuery)->pluck('quantity', 'product_id')->map(fn ($q) => (int) $q);

        // Commandes en ligne remises depuis le dernier relevé : le partenaire a encaissé, il doit reverser
        $online = Order::query()->with('items')->where('pickup_point_id', $point->id)->where('channel', OrderChannel::Online)
            ->whereNotNull('picked_up_at')->whereNull('consignment_statement_id')->get();
        $onlineQty = [];
        foreach ($online as $o) {
            foreach ($o->items as $item) {
                $onlineQty[$item->product_id] = ($onlineQty[$item->product_id] ?? 0) + $item->quantity;
            }
        }

        $ids = collect($expected->keys())->merge(array_keys($counts))->merge(array_keys($onlineQty))->unique()->values();
        $products = Product::query()->whereIn('id', $ids)->get()->keyBy('id');
        $lines = [];
        $errors = [];
        $counterTotal = $damagedValue = 0;
        foreach ($ids->sort() as $id) {
            $product = $products[$id] ?? null;
            if (! $product) {
                continue;
            }
            $exp = $expected[$id] ?? 0;
            $counted = max(0, (int) ($counts[$id]['counted'] ?? $exp));
            $damaged = max(0, (int) ($counts[$id]['damaged'] ?? 0));
            if ($counted + $damaged > $exp) {
                $errors["counts.{$id}.counted"] = "{$product->displayName()} : {$counted} compté(s) + {$damaged} abîmé(s) dépassent le stock attendu ({$exp}). Vérifiez le comptage.";
            }
            $counterSold = max(0, $exp - $counted - $damaged);
            $counterTotal += $counterSold * $product->price;
            $damagedValue += $damaged * $product->price;
            if ($exp === 0 && $counted === 0 && ! isset($onlineQty[$id])) {
                continue; // produit jamais confié : pas de ligne
            }
            $lines[] = [
                'product_id' => (int) $id, 'product_name' => $product->displayName(), 'unit_price' => $product->price,
                'expected_qty' => $exp, 'counted_qty' => $counted, 'damaged_qty' => $damaged,
                'counter_sold_qty' => $counterSold, 'online_qty' => $onlineQty[$id] ?? 0,
                'line_total' => ($counterSold + ($onlineQty[$id] ?? 0)) * $product->price,
            ];
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $onlineTotal = (int) $online->sum('subtotal');
        $sales = $counterTotal + $onlineTotal;
        $rate = (float) $point->commission_rate;
        $gross = (int) round($sales * $rate / 100);
        // Règle du 9 novembre : les abîmés se déduisent de la commission, qui ne descend jamais sous 0
        $net = max(0, $gross - $damagedValue);

        return [
            'lines' => $lines,
            'totals' => [
                'counter_sales_total' => $counterTotal, 'online_sales_total' => $onlineTotal, 'sales_total' => $sales,
                'commission_rate' => $rate, 'commission_gross' => $gross, 'damaged_value' => $damagedValue,
                'commission_net' => $net, 'amount_due' => $sales - $net,
                'sold_qty' => (int) collect($lines)->sum(fn ($l) => $l['counter_sold_qty'] + $l['online_qty']),
                'damaged_qty' => (int) collect($lines)->sum('damaged_qty'),
            ],
            'online_order_ids' => $online->pluck('id')->all(),
        ];
    }

    /** Valider le relevé : stock du partenaire ramené au comptage, ventes au comptoir enregistrées, montant dû */
    public function validateStatement(PickupPoint $point, string $period, array $counts, ?int $declaredSold, ?string $gapNote, User $by): ConsignmentStatement
    {
        if (ConsignmentStatement::query()->where('pickup_point_id', $point->id)->where('period', $period)->exists()) {
            throw ValidationException::withMessages(['period' => 'Le relevé de ce mois est déjà validé.']);
        }

        return DB::transaction(function () use ($point, $period, $counts, $declaredSold, $gapNote, $by) {
            $r = $this->compute($point, $counts, lock: true);
            $t = $r['totals'];
            if ($declaredSold !== null && $declaredSold !== $t['sold_qty'] && blank($gapNote)) {
                throw ValidationException::withMessages(['gap_note' => "Écart : le partenaire déclare {$declaredSold} produit(s) vendu(s), le comptage en donne {$t['sold_qty']}. Notez l’explication."]);
            }

            $statement = ConsignmentStatement::create([
                'number' => $this->references->next('statement', 'REL'),
                'pickup_point_id' => $point->id,
                'period' => $period,
                'counter_sales_total' => $t['counter_sales_total'], 'online_sales_total' => $t['online_sales_total'],
                'sales_total' => $t['sales_total'], 'commission_rate' => $t['commission_rate'],
                'commission_gross' => $t['commission_gross'], 'damaged_value' => $t['damaged_value'],
                'commission_net' => $t['commission_net'], 'amount_due' => $t['amount_due'],
                'due_date' => CarbonImmutable::createFromFormat('Y-m-d', "{$period}-01")->addMonth()->setDay(5)->toDateString(),
                'declared_sold' => $declaredSold, 'gap_note' => $gapNote ? trim($gapNote) : null,
                'validated_by' => $by->id,
            ]);

            $products = Product::query()->whereIn('id', array_column($r['lines'], 'product_id'))->get()->keyBy('id');
            foreach ($r['lines'] as $line) {
                $statement->items()->create(collect($line)->except('line_total')->all());
                $product = $products[$line['product_id']];
                if ($line['counter_sold_qty'] > 0) {
                    $this->move($point, $product, -$line['counter_sold_qty'], 'counter_sale', $statement, $by->id);
                }
                if ($line['damaged_qty'] > 0) {
                    $this->move($point, $product, -$line['damaged_qty'], 'damaged', $statement, $by->id);
                }
            }

            if ($t['counter_sales_total'] > 0) {
                $statement->update(['counter_order_id' => $this->createCounterOrder($point, $statement, $r['lines'], $products, $by)->id]);
            }
            Order::query()->whereIn('id', $r['online_order_ids'])->update(['consignment_statement_id' => $statement->id]);

            return $statement->load('items');
        });
    }

    /** Le partenaire a versé l'argent : chaque commande du relevé est encaissée (et sa facture émise) */
    public function recordPayment(ConsignmentStatement $statement, PaymentMethod $method, User $by): ConsignmentStatement
    {
        if ($statement->paid_at) {
            throw ValidationException::withMessages(['statement' => 'Ce relevé est déjà payé.']);
        }

        return DB::transaction(function () use ($statement, $method, $by) {
            $orders = Order::query()->with('customer')->where(fn ($q) => $q->where('consignment_statement_id', $statement->id)->orWhere('id', $statement->counter_order_id))
                ->where('payment_status', PaymentStatus::Unpaid)->get();
            foreach ($orders as $order) {
                $this->recordPayment->execute($order, $method, $by, "{$statement->number} · {$order->reference}"); // référence unique par paiement
            }
            $statement->update(['paid_at' => now(), 'payment_method' => $method->value]);

            return $statement;
        });
    }

    /** Alerte : des produits abîmés deux relevés de suite → une investigation s'impose */
    public function needsInvestigation(PickupPoint $point): bool
    {
        $last = ConsignmentStatement::query()->where('pickup_point_id', $point->id)->latest('period')->limit(2)->get();

        return $last->count() === 2 && $last->every(fn ($s) => $s->damaged_value > 0);
    }

    // ---------- Interne ----------

    /** Ventes au comptoir constatées : une commande « partenaire », livrée, à encaisser avec le relevé */
    private function createCounterOrder(PickupPoint $point, ConsignmentStatement $statement, array $lines, Collection $products, User $by): Order
    {
        $order = Order::create([
            'reference' => $this->references->next('order', 'CMD'),
            'customer_id' => $this->partnerCustomer($point)->id,
            'created_by' => $by->id,
            'channel' => OrderChannel::Partner,
            'status' => OrderStatus::Delivered,
            'payment_status' => PaymentStatus::Unpaid,
            'fulfillment_method' => FulfillmentMethod::PickupPoint,
            'pickup_point_id' => $point->id,
            'subtotal' => $statement->counter_sales_total, 'discount_total' => 0, 'tax_rate' => 0, 'tax_total' => 0,
            'shipping_fee' => 0, 'total' => $statement->counter_sales_total,
            'customer_notes' => "Ventes au comptoir, relevé {$statement->number} ({$statement->period})",
            'placed_at' => now(), 'confirmed_at' => now(), 'delivered_at' => now(),
        ]);
        foreach ($lines as $line) {
            if ($line['counter_sold_qty'] > 0) {
                $p = $products[$line['product_id']];
                $order->items()->create([
                    'product_id' => $p->id, 'product_name' => $line['product_name'], 'sku' => $p->sku,
                    'unit_price' => $line['unit_price'], 'unit_cost' => $p->cost_price,
                    'quantity' => $line['counter_sold_qty'], 'line_total' => $line['unit_price'] * $line['counter_sold_qty'],
                ]);
            }
        }

        return $order;
    }

    private function partnerCustomer(PickupPoint $point): Customer
    {
        if ($point->customer_id && ($c = Customer::find($point->customer_id))) {
            return $c;
        }
        [$first, $last] = array_pad(explode(' ', trim($point->owner_name), 2), 2, '');
        $customer = Customer::firstOrCreate(['phone' => Phone::normalize($point->phone)], [
            'first_name' => $first, 'last_name' => $last ?: $point->city, 'customer_type' => CustomerType::Reseller,
            'notes' => "Point de retrait partenaire : {$point->name}",
        ]);
        $point->update(['customer_id' => $customer->id]);

        return $customer;
    }

    /** Mouvement du stock d'un partenaire : verrou, contrôle (jamais négatif), grand livre */
    private function move(PickupPoint $point, Product $product, int $delta, string $type, ?Model $reference = null, ?int $userId = null): void
    {
        DB::table('pickup_point_stocks')->insertOrIgnore([
            'pickup_point_id' => $point->id, 'product_id' => $product->id, 'quantity' => 0, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $current = (int) DB::table('pickup_point_stocks')->where(['pickup_point_id' => $point->id, 'product_id' => $product->id])->lockForUpdate()->value('quantity');
        $balance = $current + $delta;
        if ($balance < 0) {
            throw new InsufficientStockException([['product_id' => $product->id, 'name' => $product->displayName(), 'requested' => -$delta, 'available' => $current]]);
        }
        DB::table('pickup_point_stocks')->where(['pickup_point_id' => $point->id, 'product_id' => $product->id])->update(['quantity' => $balance, 'updated_at' => now()]);
        DB::table('pickup_point_movements')->insert([
            'pickup_point_id' => $point->id, 'product_id' => $product->id, 'type' => $type, 'quantity' => $delta,
            'balance_after' => $balance, 'reference_type' => $reference?->getMorphClass(), 'reference_id' => $reference?->getKey(),
            'user_id' => $userId, 'created_at' => now(),
        ]);
    }
}
