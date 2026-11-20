<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Spatie\Activitylog\Models\Activity;

/**
 * TARIFS DE LIVRAISON dans l'ERP (maquette validée le 21 novembre 2026).
 * Une zone ne se supprime pas (les anciennes commandes y renvoient) : on la cache du site.
 * Changer des frais vaut pour les NOUVELLES commandes : une commande garde ses frais (orders.shipping_fee).
 */
class DeliveryAdminController extends Controller
{
    public function index(): JsonResponse
    {
        $counts = Order::query()->whereNotNull('delivery_zone_id')->where('status', '!=', OrderStatus::Cancelled->value)
            ->where('placed_at', '>=', now()->subDays(30))->groupBy('delivery_zone_id')->selectRaw('delivery_zone_id, count(*) as n')->pluck('n', 'delivery_zone_id');
        $zones = DeliveryZone::query()->orderByDesc('is_active')->orderBy('fee')->orderBy('name')->get();
        $history = Activity::query()->with('causer')->where('log_name', 'delivery')->latest('id')->limit(5)->get();

        return response()->json(['data' => [
            'zones' => $zones->map(fn (DeliveryZone $z) => $this->row($z) + ['orders_30d' => (int) ($counts[$z->id] ?? 0)])->values(),
            'free_delivery_threshold' => Setting::freeDeliveryThreshold(),
            'history' => $history->map(fn (Activity $a) => [
                'id' => $a->id, 'event' => $a->event, 'description' => $a->description,
                'causer' => $a->causer instanceof User ? trim($a->causer->first_name.' '.$a->causer->last_name) : 'Système',
                'subject' => DeliveryZone::query()->find($a->subject_id)?->name,
                'changes' => $a->properties, 'created_at' => Carbon::make($a->created_at)?->format('Y-m-d\TH:i:s'),
            ])->values(),
        ]]);
    }

    public function store(Request $request): JsonResponse
    {
        // is_active explicite : après create(), la valeur par défaut de la base n'est pas relue dans l'objet
        $zone = DeliveryZone::create(['is_active' => true, ...$this->validated($request, null)]);

        return response()->json(['data' => $this->row($zone) + ['orders_30d' => 0]], 201);
    }

    public function update(Request $request, DeliveryZone $zone): JsonResponse
    {
        $zone->update($this->validated($request, $zone));

        return response()->json(['data' => $this->row($zone->fresh() ?? $zone)]);
    }

    /** Livraison offerte à partir d'un montant d'achats (hors livraison) ; null = désactivée */
    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate(['free_delivery_threshold' => ['present', 'nullable', 'integer', 'min:1000', 'max:10000000']],
            ['free_delivery_threshold.min' => 'Le seuil de livraison offerte doit être d’au moins 1 000 F.'], ['free_delivery_threshold' => 'seuil de livraison offerte']);
        $before = Setting::freeDeliveryThreshold();
        Setting::put('delivery', 'delivery.free_threshold', $data['free_delivery_threshold']);
        activity('delivery')->causedBy($request->user())->withProperties(['old' => ['free_delivery_threshold' => $before], 'attributes' => ['free_delivery_threshold' => $data['free_delivery_threshold']]])
            ->event('settings')->log('free delivery threshold');

        return response()->json(['data' => ['free_delivery_threshold' => Setting::freeDeliveryThreshold()]]);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?DeliveryZone $zone): array
    {
        $data = $request->validate([
            'name' => [$zone ? 'sometimes' : 'required', 'string', 'min:2', 'max:100', Rule::unique('delivery_zones', 'name')->ignore($zone?->id)],
            'fee' => [$zone ? 'sometimes' : 'required', 'integer', 'min:0', 'max:1000000'],
            'delay_label' => ['sometimes', 'nullable', 'string', 'max:40'],
            'is_active' => ['sometimes', 'boolean'],
        ], ['name.unique' => 'Cette zone existe déjà.'], ['name' => 'nom de la zone', 'fee' => 'frais de livraison', 'delay_label' => 'délai annoncé']);
        if (array_key_exists('name', $data)) {
            $data['name'] = trim($data['name']);
        }
        if (array_key_exists('delay_label', $data)) {
            $data['delay_label'] = trim((string) $data['delay_label']) ?: null;
        }

        return $data;
    }

    /** @return array<string, mixed> */
    private function row(DeliveryZone $z): array
    {
        return ['id' => $z->id, 'name' => $z->name, 'fee' => $z->fee, 'delay_label' => $z->delay_label, 'is_active' => $z->is_active,
            'updated_at' => $z->updated_at?->format('Y-m-d\TH:i:s')];
    }
}
