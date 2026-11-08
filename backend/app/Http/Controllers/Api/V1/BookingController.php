<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\CreateBookingAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Http\Resources\BookingConfirmationResource;
use App\Notifications\BookingReceived;
use App\Support\Notify;
use Illuminate\Http\JsonResponse;

class BookingController extends Controller
{
    /** Réservation avec OU sans compte (EF-PUB-08) */
    public function store(StoreBookingRequest $request, CreateBookingAction $createBooking): JsonResponse
    {
        $booking = $createBooking->execute($request->validated(), $request->user('sanctum'));
        Notify::customer($booking->loadMissing('customer')->customer, new BookingReceived($booking));

        return (new BookingConfirmationResource($booking->load('stylist')))->response()->setStatusCode(201);
    }
}
