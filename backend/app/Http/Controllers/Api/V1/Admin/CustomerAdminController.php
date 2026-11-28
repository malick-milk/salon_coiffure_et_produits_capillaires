<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Services\Customers\MarketingConsent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Fichier clients (EF-ERP-05) : inscrits ET invités, avec ce qu'ils rapportent */
class CustomerAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $f = $request->validate(['search' => ['nullable', 'string', 'max:100'], 'type' => ['nullable', 'in:individual,reseller'], 'page' => ['nullable', 'integer', 'min:1'], 'marketing' => ['nullable', 'boolean']]);
        // Montants dépensés : gérante et manager seulement (la caisse voit la fiche SANS les montants, 28 novembre 2026)
        $stats = $request->user()->can('customers.stats');
        $page = Customer::query()
            ->withCount('orders')->withCount('bookings')
            ->withSum(['orders as orders_spent' => fn ($q) => $q->where('payment_status', PaymentStatus::Paid)], 'total')
            ->withSum(['bookings as bookings_spent' => fn ($q) => $q->where('status', BookingStatus::Completed)], 'price')
            ->with(['consents' => fn ($q) => $q->with('recorder')->latest('id')])
            ->when($f['type'] ?? null, fn ($q, $t) => $q->where('customer_type', $t))
            ->when($request->boolean('marketing'), fn ($q) => $q->where('marketing_consent', true))
            ->when($f['search'] ?? null, function ($q, $s) {
                $term = '%'.addcslashes($s, '%_\\').'%';
                $q->where(fn ($w) => $w->where('first_name', 'like', $term)->orWhere('last_name', 'like', $term)->orWhere('phone', 'like', $term)->orWhere('email', 'like', $term));
            })
            ->orderBy('last_name')->paginate(25);

        return response()->json([
            'data' => $page->getCollection()->map(fn (Customer $c) => [
                'id' => $c->id, 'name' => $c->fullName(), 'phone' => $c->phone, 'email' => $c->email, 'type' => $c->customer_type->value,
                'has_account' => $c->user_id !== null, 'orders_count' => $c->orders_count, 'bookings_count' => $c->bookings_count,
                'total_spent' => $stats ? (int) $c->orders_spent + (int) $c->bookings_spent : null, // valeur vie client (CLV historique)
                'marketing' => self::marketing($c),
                'since' => $c->created_at?->toDateString(),
            ]),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(),
                'marketing_total' => Customer::query()->where('marketing_consent', true)->count(), 'can_see_amounts' => $stats],
        ]);
    }

    /** « Elle accepte les offres par e-mail » : accord donné AU SALON, noté par la personne de la caisse (avec son nom) */
    public function recordMarketingConsent(Request $request, Customer $customer): JsonResponse
    {
        // Offres PAR E-MAIL : sans adresse, l'accord ne servirait à rien (et fausserait le compteur)
        abort_if(! $customer->email, 422, 'Cette cliente n’a pas d’e-mail : ajoutez-le d’abord sur sa fiche.');
        // Déjà accepté (double clic, autre poste) : on répond OK avec l'état actuel, sans nouvelle preuve
        MarketingConsent::record($customer, true, 'salon', $request->user());

        return response()->json(['data' => ['id' => $customer->id, 'marketing' => self::marketing($customer->fresh(['consents.recorder']))]]);
    }

    /** État actuel + preuve du dernier changement : « Accepte · au salon (Khady), 30 nov. 2026 » */
    private static function marketing(Customer $c): array
    {
        $last = $c->consents->first();
        $status = $c->marketing_consent ? 'yes' : ($last && ! $last->granted ? 'withdrawn' : 'no');

        return ['status' => $status, 'source' => $last?->source, 'at' => $last?->created_at?->toDateString(),
            'by' => $last?->recorder ? trim($last->recorder->first_name.' '.$last->recorder->last_name) : null];
    }
}
