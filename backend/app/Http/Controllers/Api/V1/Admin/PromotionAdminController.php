<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Promotion;
use App\Services\Catalog\PromotionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * PROMOTIONS DANS L'ERP (maquettes validées le 20 novembre 2026) : liste, création, modification, arrêt, résultats.
 * Règles : 5 à 70 % (confirmation au-delà de 50 %) ; un produit dans une seule promotion à la fois sur des
 * dates qui se chevauchent ; la gamme garde son prix membre (pas de promotion en plus) ; prix initial intact.
 */
class PromotionAdminController extends Controller
{
    /** Jours comparés AVANT le début de la promotion */
    private const DAYS_BEFORE = 7;

    public function index(): JsonResponse
    {
        $promotions = Promotion::query()->with('products')->orderByDesc('starts_on')->orderByDesc('id')->get();

        return response()->json(['data' => $promotions->map(fn (Promotion $p) => $this->row($p) + ['summary' => $this->totals($p)])]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, null);
        $promotion = DB::transaction(function () use ($data, $request) {
            $promotion = Promotion::create([...collect($data)->only(['name', 'percent', 'starts_on', 'ends_on', 'audience'])->all(), 'created_by' => $request->user()->id]);
            $promotion->products()->sync($data['product_ids']);

            return $promotion;
        });

        return response()->json(['data' => $this->row($promotion->load('products'))], 201);
    }

    public function update(Request $request, Promotion $promotion): JsonResponse
    {
        $status = $promotion->status();
        if ($status === 'ended') {
            throw ValidationException::withMessages(['promotion' => 'Cette promotion est terminée : elle ne se modifie plus.']);
        }
        $data = $this->validated($request, $promotion);
        // En cours : seuls le nom et la date de fin changent (les ventes déjà faites gardent leur prix)
        $fields = $status === 'current' ? ['name', 'ends_on'] : ['name', 'percent', 'starts_on', 'ends_on', 'audience'];
        DB::transaction(function () use ($promotion, $data, $fields, $status) {
            $promotion->update(collect($data)->only($fields)->all());
            if ($status === 'upcoming') {
                $promotion->products()->sync($data['product_ids']);
            }
        });

        return response()->json(['data' => $this->row($promotion->fresh('products'))]);
    }

    /** « Arrêter maintenant » : une promotion en cours s'arrête tout de suite ; une promotion à venir est annulée */
    public function stop(Promotion $promotion): JsonResponse
    {
        if ($promotion->status() === 'ended') {
            throw ValidationException::withMessages(['promotion' => 'Cette promotion est déjà terminée.']);
        }
        $promotion->update(['stopped_at' => now()]);

        return response()->json(['data' => $this->row($promotion->fresh('products'))]);
    }

    /** Résultats : 7 jours avant contre pendant, par jour et par produit (maquette « Résultats ») */
    public function results(Promotion $promotion): JsonResponse
    {
        $promotion->load('products');
        $ids = $promotion->products->pluck('id');
        [$before, $during] = $this->windows($promotion);
        $from = $before[0];
        $to = $during ? $during[1] : $before[1];
        $items = $this->sales($ids, $from, $to);

        $series = [];
        for ($day = $from->copy(); $day->lte($to); $day->addDay()) {
            $date = $day->toDateString();
            $series[] = ['date' => $date, 'units' => (int) $items->where('day', $date)->sum('quantity'), 'during' => $during !== null && $day->gte($during[0])];
        }

        return response()->json(['data' => [
            ...$this->row($promotion),
            'days_before' => self::DAYS_BEFORE,
            'days_during' => $during ? (int) $during[0]->diffInDays($during[1]) + 1 : 0,
            'series' => $series,
            'totals' => $this->totals($promotion),
            'products' => $promotion->products->map(function (Product $product) use ($items, $promotion, $before, $during) {
                $mine = $items->where('product_id', $product->id);

                return [
                    'id' => $product->id, 'name' => $product->displayName(), 'stock' => $product->availableQuantity(),
                    ...$this->compare($mine, $promotion, $before, $during),
                ];
            })->values(),
        ]]);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?Promotion $promotion): array
    {
        $current = $promotion?->status() === 'current';
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'percent' => [$current ? 'sometimes' : 'required', 'integer', 'min:5', 'max:70'],
            'confirm_high_discount' => ['sometimes', 'boolean'],
            'starts_on' => [$current ? 'sometimes' : 'required', 'date_format:Y-m-d', ...($current ? [] : ['after_or_equal:today'])],
            'ends_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.($current ? 'today' : 'starts_on')],
            'audience' => [$current ? 'sometimes' : 'required', Rule::in(['all', 'members'])],
            'product_ids' => [$current ? 'sometimes' : 'required', 'array', 'min:1', 'max:100'],
            'product_ids.*' => ['integer', 'distinct', 'exists:products,id'],
        ], [
            'percent.min' => 'La réduction va de 5 % à 70 %.', 'percent.max' => 'La réduction va de 5 % à 70 %.',
            'product_ids.required' => 'Choisissez au moins un produit.', 'product_ids.min' => 'Choisissez au moins un produit.',
        ], ['name' => 'nom de la promotion', 'percent' => 'réduction', 'starts_on' => 'date de début', 'ends_on' => 'date de fin', 'audience' => 'public visé', 'product_ids' => 'produits']);

        if ($current) {
            return $data; // en cours : produits, pourcentage et début ne bougent plus
        }
        if ($data['percent'] > 50 && ! ($data['confirm_high_discount'] ?? false)) {
            throw ValidationException::withMessages(['percent' => 'Plus de 50 % de réduction : confirmez que c’est voulu.']);
        }
        $products = Product::query()->whereIn('id', $data['product_ids'])->get();
        $bundles = $products->filter(fn (Product $p) => $p->member_price !== null);
        if ($bundles->isNotEmpty()) {
            throw ValidationException::withMessages(['product_ids' => $bundles->map->displayName()->join(', ').' a déjà son prix membre : pas de promotion en plus.']);
        }
        // Un produit dans une seule promotion à la fois : pas deux promotions sur des dates qui se chevauchent
        $taken = Promotion::query()->whereNull('stopped_at')->when($promotion, fn ($q) => $q->whereKeyNot($promotion->id))
            ->where('starts_on', '<=', $data['ends_on'])->where('ends_on', '>=', $data['starts_on'])
            ->whereHas('products', fn ($q) => $q->whereIn('products.id', $data['product_ids']))->with('products')->get();
        if ($taken->isNotEmpty()) {
            $names = $taken->flatMap(fn (Promotion $p) => $p->products->whereIn('id', $data['product_ids'])->map(fn ($x) => $x->displayName().' (« '.$p->name.' »)'))->unique()->join(', ');
            throw ValidationException::withMessages(['product_ids' => "Déjà en promotion sur ces dates : {$names}."]);
        }

        return $data;
    }

    /** @return array<string, mixed> */
    private function row(Promotion $p): array
    {
        $margins = $p->products->map(function (Product $product) use ($p) {
            $price = PromotionService::discounted($product->price, $p->percent);

            return $product->cost_price === null || $price === 0 ? null : round(100 * ($price - (float) $product->cost_price) / $price, 1);
        });

        return [
            'id' => $p->id, 'name' => $p->name, 'percent' => $p->percent, 'audience' => $p->audience, 'status' => $p->status(),
            'starts_on' => $p->starts_on->toDateString(), 'ends_on' => $p->ends_on->toDateString(), 'last_day' => $p->lastDay()->toDateString(),
            'stopped_at' => $p->stopped_at?->format('Y-m-d\TH:i:s'),
            'products' => $p->products->map(fn (Product $x) => ['id' => $x->id, 'name' => $x->displayName(), 'price' => $x->price,
                'promo_price' => PromotionService::discounted($x->price, $p->percent), 'cost_price' => $x->cost_price !== null ? (float) $x->cost_price : null])->values(),
            // Marge la plus basse après remise (sur les produits dont le coût est connu) ; null si aucun coût connu
            'min_margin_rate' => $margins->filter(fn ($m) => $m !== null)->min(),
            'unknown_cost' => $margins->contains(null),
        ];
    }

    /** @return array<string, mixed> */
    private function totals(Promotion $p): array
    {
        [$before, $during] = $this->windows($p);
        $items = $this->sales($p->products->pluck('id'), $before[0], $during ? $during[1] : $before[1]);

        return $this->compare($items, $p, $before, $during) + ['units_sold' => (int) $items->where('promotion_id', $p->id)->sum('quantity')];
    }

    /**
     * Fenêtres comparées : [7 jours avant le début] et [début -> aujourd'hui, ou dernier jour si terminée]
     *
     * @return array{0: array{0: Carbon, 1: Carbon}, 1: array{0: Carbon, 1: Carbon}|null}
     */
    private function windows(Promotion $p): array
    {
        $start = $p->starts_on->copy()->startOfDay();
        $before = [$start->copy()->subDays(self::DAYS_BEFORE), $start->copy()->subDay()];
        $end = $p->lastDay()->min(now()->startOfDay());

        return [$before, $start->lte($end) ? [$start, $end] : null];
    }

    /**
     * Lignes de commande (non annulées) de ces produits entre deux dates, avec leur jour
     *
     * @param  Collection<int, int>  $productIds
     * @return Collection<int, object>
     */
    private function sales(Collection $productIds, Carbon $from, Carbon $to): Collection
    {
        return DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereIn('order_items.product_id', $productIds)->where('orders.status', '!=', OrderStatus::Cancelled->value)
            ->whereBetween('orders.placed_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->get(['order_items.product_id', 'order_items.quantity', 'order_items.line_total', 'order_items.unit_cost', 'order_items.unit_price',
                'order_items.regular_unit_price', 'order_items.promotion_id', DB::raw('DATE(orders.placed_at) as day')]);
    }

    /**
     * Par jour, avant contre pendant : unités, chiffre d'affaires, marge, remise accordée
     *
     * @param  Collection<int, object>  $items
     * @param  array{0: Carbon, 1: Carbon}  $before
     * @param  array{0: Carbon, 1: Carbon}|null  $during
     * @return array<string, mixed>
     */
    private function compare(Collection $items, Promotion $p, array $before, ?array $during): array
    {
        $in = fn (array $w) => $items->filter(fn ($i) => $i->day >= $w[0]->toDateString() && $i->day <= $w[1]->toDateString());
        $perDay = function (Collection $rows, int $days) use ($p) {
            $known = $rows->filter(fn ($i) => $i->unit_cost !== null);

            return [
                'units' => round($rows->sum('quantity') / $days, 1),
                'revenue' => (int) round($rows->sum('line_total') / $days),
                'margin' => (int) round($known->sum(fn ($i) => $i->line_total - (float) $i->unit_cost * $i->quantity) / $days),
                'margin_partial' => $known->count() < $rows->count(), // des ventes sans coût connu : marge sous-estimée
                'discount' => (int) round($rows->where('promotion_id', $p->id)->sum(fn ($i) => ($i->regular_unit_price - $i->unit_price) * $i->quantity) / $days),
            ];
        };
        $b = $perDay($in($before), self::DAYS_BEFORE);
        $d = $during ? $perDay($in($during), (int) $during[0]->diffInDays($during[1]) + 1) : null;
        $change = fn (string $k) => $d && $b[$k] > 0 ? (int) round(100 * ($d[$k] / $b[$k] - 1)) : null;

        return ['before' => $b, 'during' => $d, 'change' => ['units' => $change('units'), 'revenue' => $change('revenue'), 'margin' => $change('margin')]];
    }
}
