<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ChangeBookingStatusAction;
use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Planning du salon (EF-RES-06, 07, 10) */
class BookingAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $f = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'stylist_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::enum(BookingStatus::class)],
        ]);
        $bookings = Booking::query()->with(['customer', 'stylist'])
            ->whereBetween('starts_at', [$f['from'].' 00:00:00', $f['to'].' 23:59:59'])
            ->when($f['stylist_id'] ?? null, fn ($q, $id) => $q->where('stylist_id', $id))
            ->when($f['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->orderBy('starts_at')->get();

        return response()->json(['data' => $bookings->map(fn (Booking $b) => $this->row($b))]);
    }

    public function updateStatus(Request $request, string $reference, ChangeBookingStatusAction $change): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::enum(BookingStatus::class)], 'reason' => ['nullable', 'string', 'max:255']]);
        $booking = Booking::query()->where('reference', $reference)->with(['customer', 'stylist'])->firstOrFail();
        $change->execute($booking, BookingStatus::from($data['status']), $data['reason'] ?? null);

        return response()->json(['data' => $this->row($booking->fresh(['customer', 'stylist']))]);
    }

    private function row(Booking $b): array
    {
        return [
            'reference' => $b->reference, 'status' => $b->status->value, 'service_name' => $b->service_name,
            'stylist_id' => $b->stylist_id, 'stylist_name' => $b->stylist->display_name,
            'customer_name' => $b->customer->fullName(), 'customer_phone' => $b->customer->phone,
            'starts_at' => $b->starts_at->format('Y-m-d\TH:i:s'), 'duration_minutes' => $b->duration_minutes,
            'price' => $b->price, 'customer_notes' => $b->customer_notes,
            'allowed_transitions' => array_map(fn (BookingStatus $s) => $s->value, $b->status->transitions()),
        ];
    }
}
