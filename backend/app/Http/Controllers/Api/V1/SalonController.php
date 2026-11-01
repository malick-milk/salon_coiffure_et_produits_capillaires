<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AvailabilityRequest;
use App\Http\Resources\BusinessHourResource;
use App\Http\Resources\DeliveryZoneResource;
use App\Http\Resources\ServiceResource;
use App\Http\Resources\StylistResource;
use App\Models\BusinessHour;
use App\Models\DeliveryZone;
use App\Models\Service;
use App\Models\Stylist;
use App\Services\Booking\AvailabilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Informations publiques du salon : prestations, coiffeurs, horaires, disponibilités, zones de livraison */
class SalonController extends Controller
{
    public function services(): AnonymousResourceCollection
    {
        return ServiceResource::collection(Service::query()->active()->with('category')->orderBy('position')->get());
    }

    public function stylists(Request $request): AnonymousResourceCollection
    {
        $request->validate(['service_id' => ['nullable', 'integer']]);
        $stylists = Stylist::query()->active()->with('services:id')
            ->when($request->integer('service_id'), fn ($q, $id) => $q->whereHas('services', fn ($s) => $s->whereKey($id)))
            ->orderBy('display_name')->get();

        return StylistResource::collection($stylists);
    }

    public function businessHours(): AnonymousResourceCollection
    {
        return BusinessHourResource::collection(BusinessHour::query()->orderBy('day_of_week')->get());
    }

    public function deliveryZones(): AnonymousResourceCollection
    {
        return DeliveryZoneResource::collection(DeliveryZone::query()->active()->orderBy('fee')->get());
    }

    public function availability(AvailabilityRequest $request, AvailabilityService $availability): JsonResponse
    {
        $service = Service::query()->active()->findOrFail($request->integer('service_id'));
        $candidates = $service->stylists()->active()->pluck('stylists.id')->all();
        $stylistIds = $request->filled('stylist_id') ? array_values(array_intersect($candidates, [$request->integer('stylist_id')])) : $candidates;

        $day = $availability->forDay($request->string('date')->toString(), $service, $stylistIds);
        // On ne divulgue pas QUELS coiffeurs sont libres : seulement disponible / indisponible
        $day['slots'] = array_map(fn ($s) => ['time' => $s['time'], 'available' => $s['available']], $day['slots']);

        return response()->json(['data' => $day]);
    }
}
