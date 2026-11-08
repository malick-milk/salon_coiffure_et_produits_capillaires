<?php

namespace App\Services\Satisfaction;

use App\Enums\BookingStatus;
use App\Enums\OrderStatus;
use App\Models\Booking;
use App\Models\Order;
use App\Models\SatisfactionSurvey;
use App\Notifications\SatisfactionSurveyRequest;
use App\Support\Notify;
use Illuminate\Support\Str;

/**
 * Envoi des enquêtes de satisfaction (étape 13).
 *
 * Règles :
 * - une enquête par prestation TERMINÉE ou commande LIVRÉE, le lendemain au plus tôt, 7 jours au plus tard ;
 * - pas plus d'une enquête tous les 14 jours par cliente (une cliente fidèle n'est pas harcelée) ;
 * - seulement si la cliente a un mobile ou un e-mail ;
 * - lien personnel aléatoire (40 caractères), valable 14 jours, une seule réponse.
 */
class SurveyService
{
    public const VALID_DAYS = 14;

    public const MIN_DAYS_BETWEEN = 14;

    public const LOOKBACK_DAYS = 7;

    /** @return int nombre d'enquêtes envoyées */
    public function sendDue(): int
    {
        $from = now()->subDays(self::LOOKBACK_DAYS)->startOfDay();
        $until = now()->startOfDay(); // terminé AVANT aujourd'hui : on écrit le lendemain, pas dans l'heure
        $sent = 0;

        $bookings = Booking::query()->with('customer')
            ->where('status', BookingStatus::Completed)->whereBetween('completed_at', [$from, $until])
            ->whereNotExists(fn ($q) => $q->from('satisfaction_surveys')->whereColumn('satisfaction_surveys.booking_id', 'bookings.id'))
            ->orderBy('completed_at')->get();
        foreach ($bookings as $b) {
            $sent += (int) $this->create($b->customer, [
                'booking_id' => $b->id, 'kind' => 'booking', 'subject_label' => $b->service_name,
                'service_id' => $b->service_id, 'stylist_id' => $b->stylist_id,
            ]);
        }

        $orders = Order::query()->with('customer')
            ->where('status', OrderStatus::Delivered)->whereBetween('delivered_at', [$from, $until])
            ->whereNotExists(fn ($q) => $q->from('satisfaction_surveys')->whereColumn('satisfaction_surveys.order_id', 'orders.id'))
            ->orderBy('delivered_at')->get();
        foreach ($orders as $o) {
            $sent += (int) $this->create($o->customer, ['order_id' => $o->id, 'kind' => 'order', 'subject_label' => "Commande {$o->reference}"]);
        }

        return $sent;
    }

    private function create($customer, array $attributes): bool
    {
        if (! $customer || (! $customer->routeNotificationForSms() && ! $customer->routeNotificationForMail())) {
            return false;
        }
        $recent = SatisfactionSurvey::query()->where('customer_id', $customer->id)
            ->where('sent_at', '>=', now()->subDays(self::MIN_DAYS_BETWEEN))->exists();
        if ($recent) {
            return false;
        }

        $token = Str::random(40);
        $survey = SatisfactionSurvey::create([
            ...$attributes,
            'token_hash' => SatisfactionSurvey::hashToken($token),
            'customer_id' => $customer->id,
            'sent_at' => now(),
            'expires_at' => now()->addDays(self::VALID_DAYS),
        ]);
        Notify::customer($customer, new SatisfactionSurveyRequest($survey, $token));

        return true;
    }
}
