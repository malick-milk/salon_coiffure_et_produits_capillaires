<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Http\Controllers\Controller;
use App\Models\ConsignmentDelivery;
use App\Models\ConsignmentStatement;
use App\Models\Order;
use App\Models\PickupPoint;
use App\Models\Setting;
use App\Services\PickupPoints\PickupPointService;
use App\Support\Phone;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * ERP « Points de retrait » (étape 14). Permission : partners.manage (propriétaire et gérante).
 * Cycle : livraison mensuelle (bon de dépôt) → relevé de fin de mois (comptage) → versement avant le 5.
 */
class PickupPointAdminController extends Controller
{
    public function __construct(private PickupPointService $service) {}

    public function index(): JsonResponse
    {
        $points = PickupPoint::query()->orderBy('city')->get();
        $stock = DB::table('pickup_point_stocks')->join('products', 'products.id', '=', 'pickup_point_stocks.product_id')
            ->groupBy('pickup_point_id')->selectRaw('pickup_point_id, SUM(quantity) as units, SUM(quantity * products.price) as value')
            ->get()->keyBy('pickup_point_id');
        $last = ConsignmentStatement::query()->with('items')->whereIn('id', ConsignmentStatement::query()->selectRaw('MAX(id)')->groupBy('pickup_point_id'))
            ->get()->keyBy('pickup_point_id');
        $waiting = Order::query()->where('status', OrderStatus::Ready)->whereNotNull('pickup_point_id')
            ->groupBy('pickup_point_id')->selectRaw('pickup_point_id, COUNT(*) as n')->pluck('n', 'pickup_point_id');

        $rows = $points->map(fn (PickupPoint $p) => [
            ...$this->point($p),
            'stock_units' => (int) ($stock[$p->id]->units ?? 0),
            'stock_value' => (int) ($stock[$p->id]->value ?? 0),
            'orders_to_hand_over' => (int) ($waiting[$p->id] ?? 0),
            'last_statement' => isset($last[$p->id]) ? $this->statementRow($last[$p->id]) : null,
            'needs_investigation' => $this->service->needsInvestigation($p),
        ]);

        $unpaid = ConsignmentStatement::query()->whereNull('paid_at')->get();

        return response()->json([
            'data' => $rows,
            'summary' => [
                'active' => $points->where('is_active', true)->count(),
                'regions_covered' => $points->where('is_active', true)->flatMap->regions->unique()->values(),
                'regions' => PickupPoint::REGIONS,
                'amount_to_collect' => (int) $unpaid->sum('amount_due'),
                'overdue' => $unpaid->filter(fn ($s) => $s->paymentState() === 'overdue')->count(),
                'investigations' => $rows->where('needs_investigation', true)->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $point = PickupPoint::create($this->validated($request));

        return response()->json(['data' => $this->point($point)], 201);
    }

    public function update(Request $request, PickupPoint $pickupPoint): JsonResponse
    {
        $pickupPoint->update($this->validated($request, partial: true));

        return response()->json(['data' => $this->point($pickupPoint)]);
    }

    /** Fiche : stock confié, commandes à remettre, livraisons et relevés */
    public function show(PickupPoint $pickupPoint): JsonResponse
    {
        $stock = DB::table('pickup_point_stocks')->join('products', 'products.id', '=', 'pickup_point_stocks.product_id')
            ->where('pickup_point_id', $pickupPoint->id)->where('quantity', '>', 0)->orderBy('products.name')
            ->get(['products.id as product_id', 'products.name', 'products.unit_size', 'products.price', 'pickup_point_stocks.quantity']);

        return response()->json(['data' => [
            ...$this->point($pickupPoint),
            'needs_investigation' => $this->service->needsInvestigation($pickupPoint),
            'stock' => $stock->map(fn ($s) => ['product_id' => $s->product_id, 'name' => trim($s->name.' '.($s->unit_size ?? '')), 'price' => (int) $s->price, 'quantity' => (int) $s->quantity]),
            'orders_to_hand_over' => Order::query()->with('customer')->where('pickup_point_id', $pickupPoint->id)->where('status', OrderStatus::Ready)->latest('placed_at')->get()
                ->map(fn (Order $o) => ['reference' => $o->reference, 'customer_name' => $o->customer->fullName(), 'total' => $o->total, 'placed_at' => $o->placed_at->format('Y-m-d\TH:i:s')]),
            'deliveries' => $pickupPoint->deliveries()->latest('delivered_on')->latest('id')->limit(24)->get()
                ->map(fn (ConsignmentDelivery $d) => ['id' => $d->id, 'number' => $d->number, 'delivered_on' => $d->delivered_on->toDateString(), 'total_quantity' => $d->total_quantity, 'total_value' => $d->total_value]),
            'statements' => $pickupPoint->statements()->with('items')->latest('period')->limit(24)->get()->map(fn ($s) => $this->statementRow($s)),
        ]]);
    }

    /** Livraison mensuelle : le stock passe du salon au partenaire (il reste à Dabo Hair) */
    public function deliver(Request $request, PickupPoint $pickupPoint): JsonResponse
    {
        $data = $request->validate([
            'delivered_on' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'distinct', Rule::exists('products', 'id')],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:10000'],
        ]);
        $delivery = $this->service->deliver($pickupPoint, collect($data['items'])->pluck('quantity', 'product_id')->all(), $request->user(), $data['delivered_on'] ?? null);

        return response()->json(['data' => ['id' => $delivery->id, 'number' => $delivery->number, 'total_quantity' => $delivery->total_quantity, 'total_value' => $delivery->total_value]], 201);
    }

    /** Aperçu du relevé (rien n'est enregistré) : l'ERP l'affiche à chaque saisie du comptage */
    public function preview(Request $request, PickupPoint $pickupPoint): JsonResponse
    {
        return response()->json(['data' => $this->service->compute($pickupPoint, $this->counts($request))]);
    }

    public function validateStatement(Request $request, PickupPoint $pickupPoint): JsonResponse
    {
        $data = $request->validate([
            'period' => ['required', 'date_format:Y-m'],
            'declared_sold' => ['nullable', 'integer', 'min:0'],
            'gap_note' => ['nullable', 'string', 'max:500'],
        ]);
        $statement = $this->service->validateStatement($pickupPoint, $data['period'], $this->counts($request), $data['declared_sold'] ?? null, $data['gap_note'] ?? null, $request->user());

        return response()->json(['data' => $this->statementRow($statement)], 201);
    }

    public function recordPayment(Request $request, ConsignmentStatement $statement): JsonResponse
    {
        $data = $request->validate(['method' => ['required', Rule::enum(PaymentMethod::class)]]);
        $statement = $this->service->recordPayment($statement, PaymentMethod::from($data['method']), $request->user());

        return response()->json(['data' => $this->statementRow($statement->load('items'))]);
    }

    public function deliveryPdf(ConsignmentDelivery $delivery): Response
    {
        $delivery->load(['items', 'pickupPoint']);

        return Pdf::loadView('pdf.consignment-delivery', ['delivery' => $delivery, 'company' => $this->company()])
            ->setPaper('a4')->download("{$delivery->number}.pdf");
    }

    public function statementPdf(ConsignmentStatement $statement): Response
    {
        $statement->load(['items', 'pickupPoint']);

        return Pdf::loadView('pdf.consignment-statement', ['statement' => $statement, 'company' => $this->company()])
            ->setPaper('a4')->download("{$statement->number}.pdf");
    }

    // ---------- Interne ----------

    private function validated(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';
        if ($request->has('phone')) {
            $request->merge(['phone' => Phone::normalize($request->input('phone'))]); // « 77 123 12 34 » → « 771231234 »
        }
        $data = $request->validate([
            'name' => [$req, 'string', 'max:150'],
            'owner_name' => [$req, 'string', 'max:150'],
            'phone' => [$req, 'string', 'regex:'.Phone::SENEGAL_MOBILE],
            'email' => ['nullable', 'email', 'max:191'],
            'regions' => [$req, 'array', 'min:1'],
            'regions.*' => ['string', Rule::in(PickupPoint::REGIONS)],
            'city' => [$req, 'string', 'max:100'],
            'address' => [$req, 'string', 'max:255'],
            'opening_hours' => ['nullable', 'string', 'max:191'],
            'commission_rate' => ['sometimes', 'numeric', 'min:0', 'max:50'],
            'is_active' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        return $data;
    }

    /** @return array<int,array{counted:int,damaged:int}> */
    private function counts(Request $request): array
    {
        $data = $request->validate([
            'counts' => ['present', 'array'],
            'counts.*.product_id' => ['required', 'integer', 'distinct'],
            'counts.*.counted' => ['required', 'integer', 'min:0'],
            'counts.*.damaged' => ['nullable', 'integer', 'min:0'],
        ]);

        return collect($data['counts'])->mapWithKeys(fn ($c) => [(int) $c['product_id'] => ['counted' => (int) $c['counted'], 'damaged' => (int) ($c['damaged'] ?? 0)]])->all();
    }

    private function point(PickupPoint $p): array
    {
        return [
            'id' => $p->id, 'name' => $p->name, 'owner_name' => $p->owner_name, 'phone' => $p->phone, 'email' => $p->email,
            'regions' => $p->regions, 'city' => $p->city, 'address' => $p->address, 'opening_hours' => $p->opening_hours,
            'commission_rate' => (float) $p->commission_rate, 'is_active' => $p->is_active, 'notes' => $p->notes,
        ];
    }

    private function statementRow(ConsignmentStatement $s): array
    {
        return [
            'id' => $s->id, 'number' => $s->number, 'period' => $s->period,
            'sold_qty' => $s->soldQuantity(), 'damaged_qty' => $s->damagedQuantity(),
            'counter_sales_total' => $s->counter_sales_total, 'online_sales_total' => $s->online_sales_total, 'sales_total' => $s->sales_total,
            'commission_gross' => $s->commission_gross, 'damaged_value' => $s->damaged_value, 'commission_net' => $s->commission_net,
            'amount_due' => $s->amount_due, 'due_date' => $s->due_date->toDateString(),
            'payment_state' => $s->paymentState(), 'paid_at' => $s->paid_at?->format('Y-m-d\TH:i:s'), 'payment_method' => $s->payment_method,
            'declared_sold' => $s->declared_sold, 'gap_note' => $s->gap_note,
        ];
    }

    private function company(): array
    {
        return Setting::get('company.identity', []) ?? [];
    }
}
