<?php

namespace App\Http\Controllers\Api\V1\Me;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\CustomerBookingResource;
use App\Http\Resources\OrderDetailResource;
use App\Http\Resources\OrderSummaryResource;
use App\Http\Resources\UserResource;
use App\Models\Booking;
use App\Models\Order;
use App\Notifications\BookingCancelledByCustomer;
use App\Support\Notify;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

/**
 * Espace client : toutes les requêtes partent de l'utilisateur CONNECTÉ.
 * On ne lit jamais un identifiant de client envoyé par le navigateur.
 */
class AccountController extends Controller
{
    public function orders(Request $request): AnonymousResourceCollection
    {
        $orders = Order::query()->whereHas('customer', fn ($q) => $q->where('user_id', $request->user()->id))
            ->withSum('items as items_count', 'quantity')->latest('placed_at')->get();

        return OrderSummaryResource::collection($orders);
    }

    public function order(string $reference): OrderDetailResource
    {
        $order = Order::query()->where('reference', $reference)->with(['items.product', 'deliveryZone', 'customer'])->firstOrFail();
        Gate::authorize('view', $order); // 403 si la commande appartient à quelqu'un d'autre (anti-IDOR)

        return new OrderDetailResource($order);
    }

    public function bookings(Request $request): AnonymousResourceCollection
    {
        $bookings = Booking::query()->whereHas('customer', fn ($q) => $q->where('user_id', $request->user()->id))
            ->with('stylist')->latest('starts_at')->get();

        return CustomerBookingResource::collection($bookings);
    }

    public function cancelBooking(string $reference): CustomerBookingResource
    {
        $booking = Booking::query()->where('reference', $reference)->with(['customer', 'stylist'])->firstOrFail();
        Gate::authorize('cancel', $booking);

        abort_unless(CustomerBookingResource::canCancel($booking), 422, 'Annulation impossible à moins de 24 h du rendez-vous. Merci d’appeler le salon.');

        // Passer à « annulée » libère automatiquement le créneau (colonne générée active_slot = NULL)
        $booking->update(['status' => BookingStatus::Cancelled, 'cancelled_at' => now(), 'cancelled_by' => 'customer']);
        Notify::customer($booking->customer, new BookingCancelledByCustomer($booking));

        return new CustomerBookingResource($booking);
    }

    public function updateProfile(UpdateProfileRequest $request): UserResource
    {
        $user = $request->user();
        $user->update($request->validated());
        $user->customer?->update($request->safe()->only(['first_name', 'last_name'])); // fiche client tenue à jour

        return new UserResource($user);
    }
}
