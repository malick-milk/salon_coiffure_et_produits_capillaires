<?php

namespace App\Http\Controllers\Api\V1\Me;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Rubrique « Notifications » de l'espace client (maquette validée le 16 novembre 2026).
 * Toujours la cliente CONNECTÉE : on ne lit jamais un identifiant envoyé par le navigateur.
 */
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $customer = $this->customer($request);
        $items = $customer ? $customer->notifications()->latest()->limit(50)->get() : collect();

        return response()->json([
            'data' => $items->map(fn (DatabaseNotification $n) => [
                'id' => $n->id, ...$n->data, 'read' => $n->read_at !== null, 'created_at' => $n->created_at?->toIso8601String(),
            ])->values(),
            'meta' => ['unread' => $customer ? $customer->unreadNotifications()->count() : 0],
        ]);
    }

    /** Ouvrir la rubrique marque tout comme lu (la pastille de la cloche disparaît) */
    public function markAllRead(Request $request): JsonResponse
    {
        $this->customer($request)?->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['meta' => ['unread' => 0]]);
    }

    /** « Me le rappeler dans 1 semaine » : une seule fois par twist ; la notification disparaît en attendant */
    public function snooze(Request $request, string $id): JsonResponse
    {
        $customer = $this->customer($request);
        $notification = $customer?->notifications()->whereKey($id)->first();
        abort_unless($notification && ($notification->data['kind'] ?? null) === 'resserrage', 404);

        $booking = Booking::query()->where('customer_id', $customer->id)->where('reference', $notification->data['booking_reference'] ?? '')->firstOrFail();
        abort_if($booking->resserrage_snoozed_at !== null, 422, 'Ce rappel a déjà été reporté une fois.');

        $booking->forceFill(['resserrage_snoozed_at' => now(), 'resserrage_reminded_at' => null])->save();
        $notification->delete();

        return response()->json(['meta' => ['unread' => $customer->unreadNotifications()->count()]]);
    }

    /** Lien « Ne plus recevoir les rappels de resserrage » des e-mails : URL signée, sans connexion */
    public function unsubscribe(Customer $customer): JsonResponse
    {
        $customer->forceFill(['resserrage_opt_out' => true])->save();
        activity('customers')->performedOn($customer)->event('resserrage_opt_out')->log('resserrage reminders disabled');

        return response()->json(['message' => 'Vous ne recevrez plus de rappels de resserrage.']);
    }

    private function customer(Request $request): ?Customer
    {
        return Customer::query()->where('user_id', $request->user()->id)->first();
    }
}
