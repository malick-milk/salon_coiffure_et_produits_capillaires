<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\PlaceOrderAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreOrderRequest;
use App\Http\Resources\OrderDetailResource;
use Illuminate\Http\JsonResponse;

class OrderController extends Controller
{
    /** Commande avec OU sans compte (ADR-011) */
    public function store(StoreOrderRequest $request, PlaceOrderAction $placeOrder): JsonResponse
    {
        $order = $placeOrder->execute($request->validated(), $request->user('sanctum'));

        return (new OrderDetailResource($order))->response()->setStatusCode(201);
    }
}
