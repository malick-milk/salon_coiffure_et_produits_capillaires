<?php

namespace App\Console\Commands;

use App\Actions\Admin\ChangeBookingStatusAction;
use App\Actions\Admin\ChangeOrderStatusAction;
use App\Actions\Admin\RecordPaymentAction;
use App\Actions\Admin\RecordProductionBatchAction;
use App\Actions\CreateBookingAction;
use App\Actions\PlaceOrderAction;
use App\Enums\BookingStatus;
use App\Enums\CustomerType;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Exceptions\SlotUnavailableException;
use App\Models\Customer;
use App\Models\DeliveryZone;
use App\Models\Product;
use App\Models\Service;
use App\Models\User;
use App\Services\Analytics\SnapshotBuilder;
use App\Services\Booking\AvailabilityService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * HISTORIQUE FICTIF pour apprendre l'analyse de données (local uniquement).
 *
 * Principe : on « remonte le temps » jour par jour (Carbon::setTestNow) et on rejoue l'activité
 * avec les VRAIES classes métier (PlaceOrderAction, RecordPaymentAction…). Toutes les règles
 * s'appliquent donc : stock jamais négatif, prix lus en base, factures sans trou, créneaux libres.
 *
 * Le hasard est « graine fixe » (mt_srand) : deux exécutions produisent exactement les mêmes données,
 * ce qui rend les analyses reproductibles (indispensable pour comparer des modèles de ML).
 *
 * Effets modélisés : tendance de croissance, saisonnalité hebdomadaire (samedi fort, dimanche faible),
 * clients fidèles vs occasionnels, revendeurs (grosses commandes rares), annulations, absences.
 */
class GenerateDemoHistoryCommand extends Command
{
    protected $signature = 'app:demo-history {--days=180 : Nombre de jours d\'historique} {--seed=2026 : Graine du hasard}';

    protected $description = 'Génère un historique FICTIF et réaliste de ventes et de rendez-vous (environnement local uniquement)';

    private const MARKER = '[DÉMO] client fictif';

    /** Popularité relative des produits (par SKU) : les sérums se vendent le plus */
    private const POPULARITY = ['DAB-SAP-030' => 20, 'DAB-SBO-030' => 14, 'DAB-SPH-250' => 14, 'DAB-SHA-001' => 12, 'DAB-CRE-001' => 12,
        'DAB-MAS-001' => 10, 'DAB-SAC-001' => 8, 'DAB-HYD-100' => 6, 'DAB-SAP-015' => 6];

    /** Lundi … dimanche : coefficient d'activité */
    private const WEEKDAY = [1 => 0.8, 2 => 0.8, 3 => 0.9, 4 => 0.95, 5 => 1.1, 6 => 1.45, 7 => 0.6];

    private const FIRST_NAMES = ['Aminata', 'Fatou', 'Awa', 'Mariama', 'Khady', 'Ndeye', 'Aissatou', 'Coumba', 'Astou', 'Bineta', 'Seynabou', 'Rokhaya',
        'Adama', 'Mame Diarra', 'Sokhna', 'Yacine', 'Penda', 'Dieynaba', 'Oumou', 'Ramatoulaye', 'Maimouna', 'Ndeye Fatou', 'Anta', 'Codou', 'Marème'];

    private const LAST_NAMES = ['Diop', 'Ndiaye', 'Fall', 'Sow', 'Ba', 'Diallo', 'Sarr', 'Faye', 'Gueye', 'Mbaye', 'Cissé', 'Niang', 'Seck', 'Kane', 'Thiam', 'Diouf', 'Sy', 'Camara', 'Touré', 'Wade'];

    private User $admin;

    /** @var list<array{first_name:string,last_name:string,phone:string,email:null,type:CustomerType}> */
    private array $known = [];

    private int $phoneCounter = 0;

    private array $stats = ['orders' => 0, 'cancelled' => 0, 'bookings' => 0, 'batches' => 0];

    public function handle(SnapshotBuilder $snapshots): int
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->error('Refusé : cet historique est fictif. Il ne doit jamais être généré hors environnement local.');

            return self::FAILURE;
        }
        if (Customer::where('notes', self::MARKER)->exists()) {
            $this->error('Historique déjà généré. Pour repartir de zéro : php artisan migrate:fresh --seed');

            return self::FAILURE;
        }
        $this->admin = User::where('email', 'admin@dabohair.test')->firstOrFail();
        $days = max(7, min(730, (int) $this->option('days')));
        mt_srand((int) $this->option('seed'));

        $end = CarbonImmutable::yesterday();
        $start = $end->subDays($days - 1);
        // L'historique s'écrit DANS LE PASSÉ : s'il existe déjà des mouvements de stock après son début
        // (un lot saisi aujourd'hui, par exemple), la simulation consommerait un stock pas encore fabriqué
        // et le stock reconstruit jour par jour deviendrait faux. On exige donc une base « propre ».
        $later = DB::table('stock_movements')->where('created_at', '>=', $start)->min('created_at');
        if ($later !== null) {
            $this->error("La base contient déjà des mouvements de stock depuis le {$later}. Lancez d'abord : php artisan migrate:fresh --seed (ou réduisez --days).");

            return self::FAILURE;
        }
        // Les références de démo (CMD-2026-000101…) sont fixes : on démarre les compteurs plus loin pour ne pas les croiser
        foreach (range($start->year, $end->year) as $year) {
            foreach (['order', 'booking'] as $name) {
                DB::table('counters')->insertOrIgnore(['name' => $name, 'year' => $year, 'last_number' => 0]);
                DB::table('counters')->where(['name' => $name, 'year' => $year])->where('last_number', '<', 1000)->update(['last_number' => 1000]);
            }
        }

        activity()->disableLogging(); // le journal d'audit trace les actions HUMAINES, pas une génération de démo
        $bar = $this->output->createProgressBar($days);
        try {
            for ($day = $start; $day->lte($end); $day = $day->addDay()) {
                $growth = 0.7 + 0.6 * ($start->diffInDays($day) / max(1, $days - 1)); // tendance : +85 % sur la période
                $factor = $growth * self::WEEKDAY[$day->dayOfWeekIso];
                $recent = $day->diffInDays($end) < 3; // les derniers jours : quelques commandes encore « en cours »

                // Les commandes du jour se suivent dans l'ordre CHRONOLOGIQUE : le grand livre du stock
                // doit pouvoir être relu dans l'ordre du temps (solde courant = stock_after)
                $orders = array_fill(0, $this->poisson(2.4 * $factor), false);
                if (mt_rand(1, 100) <= 5) {
                    array_splice($orders, mt_rand(0, count($orders)), 0, [true]); // un revendeur, à un moment de la journée
                }
                $cursor = $day->setTime(8, 0);
                foreach ($orders as $reseller) {
                    $cursor = $cursor->addMinutes(mt_rand(15, (int) max(20, 660 / max(1, count($orders)))));
                    $cursor = $this->simulateOrder($cursor, $recent, $reseller);
                }
                for ($i = 0, $n = $this->poisson(3.2 * $factor); $i < $n; $i++) {
                    $this->simulateBooking($day);
                }
                $bar->advance();
            }
        } finally {
            Carbon::setTestNow();
            activity()->enableLogging();
        }
        $bar->finish();
        $this->newLine();

        $snapshots->build($start->subDays(30), CarbonImmutable::today());
        $this->info(sprintf('%d commandes (%d annulées), %d rendez-vous, %d lots de fabrication, sur %d jours.',
            $this->stats['orders'], $this->stats['cancelled'], $this->stats['bookings'], $this->stats['batches'], $days));
        $this->info('Agrégats analytiques recalculés. Ouvrez l’ERP, menu « Analyses ».');

        return self::SUCCESS;
    }

    /** @return CarbonImmutable heure du dernier mouvement de stock causé (la commande suivante viendra après) */
    private function simulateOrder(CarbonImmutable $placedAt, bool $recent, bool $reseller): CarbonImmutable
    {
        $customer = $this->pickCustomer($reseller);
        $items = $this->pickItems($reseller);
        $this->ensureStock($items, $placedAt);

        Carbon::setTestNow($placedAt);
        $delivery = ! $reseller && mt_rand(1, 100) <= 55;
        $zone = $delivery ? DeliveryZone::query()->active()->inRandomOrder(mt_rand())->first() : null;
        $order = app(PlaceOrderAction::class)->execute([
            'items' => $items,
            'fulfillment_method' => $delivery ? 'delivery' : 'pickup',
            'delivery_zone_id' => $zone?->id,
            'customer' => $customer,
            'shipping_address' => $delivery ? ['city' => 'Dakar', 'district' => $zone->name, 'address_line' => 'Adresse fictive', 'landmark' => null] : null,
            'notes' => null,
        ], null);
        $this->stats['orders']++;
        if ($reseller) {
            Customer::where('id', $order->customer_id)->update(['customer_type' => CustomerType::Reseller]);
        }

        $change = app(ChangeOrderStatusAction::class);
        $at = fn (int $minutes) => Carbon::setTestNow($placedAt->addMinutes($minutes));
        $roll = mt_rand(1, 100);
        if ($roll <= 5) { // 5 % d'annulations : le stock revient
            $at(45);
            $change->execute($order, OrderStatus::Cancelled, $this->admin, 'Annulée à la demande de la cliente');
            $this->stats['cancelled']++;

            return $placedAt->addMinutes(45); // remise en stock : dernier mouvement de cette commande
        }
        $at(20);
        $change->execute($order, OrderStatus::Confirmed, $this->admin);
        if ($recent && $roll <= 40) {
            return $placedAt; // commande récente pas encore traitée
        }
        $at(60);
        $change->execute($order->refresh(), OrderStatus::Preparing, $this->admin);
        $at(120);
        $change->execute($order->refresh(), $delivery ? OrderStatus::Shipped : OrderStatus::Ready, $this->admin);
        $at(180);
        app(RecordPaymentAction::class)->execute($order->refresh(), $this->paymentMethod($delivery), $this->admin);
        $change->execute($order->refresh(), OrderStatus::Delivered, $this->admin);

        return $placedAt; // le paiement et la livraison ne bougent pas le stock
    }

    private function simulateBooking(CarbonImmutable $day): void
    {
        $service = Service::query()->active()->inRandomOrder(mt_rand())->first();
        Carbon::setTestNow($day->subDay()->setTime(12, 0)); // réservé la veille
        $availability = app(AvailabilityService::class)->forDay($day->toDateString(), $service, $service->stylists()->active()->pluck('stylists.id')->all());
        $free = array_values(array_filter($availability['slots'], fn ($s) => $s['available']));
        if (! $availability['is_open'] || $free === []) {
            return; // dimanche, jour férié ou planning complet : la demande est perdue (comme dans la vraie vie)
        }
        $slot = $free[mt_rand(0, count($free) - 1)];
        try {
            $booking = app(CreateBookingAction::class)->execute(['service_id' => $service->id, 'stylist_id' => null, 'date' => $day->toDateString(),
                'time' => $slot['time'], 'customer' => $this->pickCustomer(false), 'notes' => null], null);
        } catch (SlotUnavailableException) {
            return;
        }
        $this->stats['bookings']++;

        $change = app(ChangeBookingStatusAction::class);
        $roll = mt_rand(1, 100);
        if ($roll <= 8) {
            Carbon::setTestNow($day->subDay()->setTime(18, 0));
            $change->execute($booking, BookingStatus::Cancelled, 'Annulé par la cliente');

            return;
        }
        Carbon::setTestNow($day->subDay()->setTime(14, 0));
        $change->execute($booking, BookingStatus::Confirmed);
        Carbon::setTestNow($day->setTime(21, 30));
        $change->execute($booking->refresh(), $roll <= 15 ? BookingStatus::NoShow : BookingStatus::Completed);
    }

    /** Fidélité : 65 % de clients déjà venus, surtout les plus anciens (loi de Pareto : peu de clients font beaucoup du CA) */
    private function pickCustomer(bool $reseller): array
    {
        $pool = array_values(array_filter($this->known, fn ($c) => ($c['type'] === CustomerType::Reseller) === $reseller));
        $reuse = $reseller ? count($pool) >= 3 : mt_rand(1, 100) <= 65;
        if ($reuse && $pool !== []) {
            $index = (int) floor(count($pool) * (mt_rand(0, 1000) / 1000) ** 2); // biais vers les premiers clients
            $c = $pool[min($index, count($pool) - 1)];
        } else {
            $c = ['first_name' => $reseller ? 'Boutique' : self::FIRST_NAMES[mt_rand(0, count(self::FIRST_NAMES) - 1)],
                'last_name' => $reseller ? self::LAST_NAMES[mt_rand(0, count(self::LAST_NAMES) - 1)].' Cosmétiques' : self::LAST_NAMES[mt_rand(0, count(self::LAST_NAMES) - 1)],
                'phone' => sprintf('7%d9%06d', [0, 6, 7, 8][mt_rand(0, 3)], ++$this->phoneCounter), 'email' => null,
                'type' => $reseller ? CustomerType::Reseller : CustomerType::Individual];
            $this->known[] = $c;
            Customer::firstOrCreate(['phone' => $c['phone']], ['first_name' => $c['first_name'], 'last_name' => $c['last_name'],
                'customer_type' => $c['type'], 'notes' => self::MARKER]);
        }

        return ['first_name' => $c['first_name'], 'last_name' => $c['last_name'], 'phone' => $c['phone'], 'email' => null];
    }

    /** @return list<array{product_id:int,quantity:int}> */
    private function pickItems(bool $reseller): array
    {
        $products = Product::query()->active()->get(['id', 'sku'])->filter(fn ($p) => isset(self::POPULARITY[$p->sku]))->keyBy('sku');
        $chosen = [];
        $lines = $reseller ? mt_rand(2, 4) : (mt_rand(1, 100) <= 60 ? 1 : mt_rand(2, 3));
        while (count($chosen) < min($lines, $products->count())) {
            $sku = $this->weighted(array_intersect_key(self::POPULARITY, $products->all()));
            $chosen[$sku] = ['product_id' => $products[$sku]->id, 'quantity' => $reseller ? 12 * mt_rand(1, 3) : (mt_rand(1, 100) <= 80 ? 1 : 2)];
        }

        return array_values($chosen);
    }

    /** Si le stock manque, l'atelier fabrique un lot le matin même (réapprovisionnement à flux tendu) */
    private function ensureStock(array $items, CarbonImmutable $placedAt): void
    {
        foreach ($items as $item) {
            $product = Product::find($item['product_id']);
            if ($product->stock_quantity >= $item['quantity']) {
                continue;
            }
            $day = $placedAt->startOfDay();
            Carbon::setTestNow($placedAt->subMinutes(5)); // fabriqué juste avant la vente qui en a besoin
            $qty = max(96, (int) ceil($item['quantity'] / 12) * 12);
            app(RecordProductionBatchAction::class)->execute([
                'product_id' => $product->id, 'batch_number' => sprintf('HIST-%s-%s-%d', substr($product->sku, 4), $day->format('ymd'), ++$this->stats['batches']),
                'quantity_produced' => $qty, 'produced_on' => $day->toDateString(), 'expires_on' => $day->addMonths(18)->toDateString(), 'notes' => 'Lot fictif (historique de démonstration)',
                // Coût connu -> même coût unitaire ; coût inconnu -> lot sans coût (la marge reste « à calculer »)
                'costs' => $product->cost_price === null ? [] : [['category' => 'ingredients', 'label' => 'Fabrication (démo)', 'amount' => (int) round((float) $product->cost_price * $qty)]],
            ], $this->admin);
        }
    }

    private function paymentMethod(bool $delivery): PaymentMethod
    {
        return PaymentMethod::from($this->weighted($delivery
            ? ['cash' => 45, 'wave' => 35, 'orange_money' => 15, 'free_money' => 5]
            : ['cash' => 30, 'wave' => 40, 'orange_money' => 20, 'free_money' => 5, 'card' => 5]));
    }

    /** Tirage pondéré : ['a' => 3, 'b' => 1] renvoie 'a' trois fois sur quatre */
    private function weighted(array $weights): string
    {
        $r = mt_rand(1, array_sum($weights));
        foreach ($weights as $key => $w) {
            if (($r -= $w) <= 0) {
                return (string) $key;
            }
        }

        return (string) array_key_last($weights);
    }

    /** Loi de Poisson : nombre d'événements aléatoires autour d'une moyenne (algorithme de Knuth) */
    private function poisson(float $lambda): int
    {
        $l = exp(-$lambda);
        $k = 0;
        $p = 1.0;
        do {
            $k++;
            $p *= mt_rand() / mt_getrandmax();
        } while ($p > $l);

        return $k - 1;
    }
}
