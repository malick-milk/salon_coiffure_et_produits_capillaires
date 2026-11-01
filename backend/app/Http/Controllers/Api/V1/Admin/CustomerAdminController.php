<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Fichier clients (EF-ERP-05) : inscrits ET invités, avec ce qu'ils rapportent */
class CustomerAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $f = $request->validate(['search' => ['nullable', 'string', 'max:100'], 'type' => ['nullable', 'in:individual,reseller'], 'page' => ['nullable', 'integer', 'min:1']]);
        $page = Customer::query()
            ->withCount('orders')->withCount('bookings')
            ->withSum(['orders as orders_spent' => fn ($q) => $q->where('payment_status', PaymentStatus::Paid)], 'total')
            ->withSum(['bookings as bookings_spent' => fn ($q) => $q->where('status', BookingStatus::Completed)], 'price')
            ->when($f['type'] ?? null, fn ($q, $t) => $q->where('customer_type', $t))
            ->when($f['search'] ?? null, function ($q, $s) {
                $term = '%'.addcslashes($s, '%_\\').'%';
                $q->where(fn ($w) => $w->where('first_name', 'like', $term)->orWhere('last_name', 'like', $term)->orWhere('phone', 'like', $term)->orWhere('email', 'like', $term));
            })
            ->orderBy('last_name')->paginate(25);

        return response()->json([
            'data' => $page->getCollection()->map(fn (Customer $c) => [
                'id' => $c->id, 'name' => $c->fullName(), 'phone' => $c->phone, 'email' => $c->email, 'type' => $c->customer_type->value,
                'has_account' => $c->user_id !== null, 'orders_count' => $c->orders_count, 'bookings_count' => $c->bookings_count,
                'total_spent' => (int) $c->orders_spent + (int) $c->bookings_spent, // valeur vie client (CLV historique)
                'since' => $c->created_at?->toDateString(),
            ]),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }
}
