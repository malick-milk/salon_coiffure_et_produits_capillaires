<?php

namespace App\Services\Customers;

use App\Models\Customer;
use App\Models\CustomerConsent;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;

/**
 * ACCORD POUR LES NOUVEAUTÉS ET OFFRES PAR E-MAIL (maquette validée le 28 novembre 2026).
 *
 * Règles : case distincte, non cochée, facultative ; chaque changement est prouvé (customer_consents) ;
 * retrait en un clic (espace client, lien signé en bas de chaque e-mail d'offre). Les rappels de resserrage
 * ont leur propre réglage (customers.resserrage_opt_out) ; confirmations, codes et factures partent toujours.
 */
final class MarketingConsent
{
    public const CHANNEL = 'email_offers';

    /** Le texte exact de la case. S'il change, changer aussi VERSION : la preuve dit quel texte a été accepté. */
    public const TEXT = 'Je veux recevoir par e-mail les nouveautés et offres de Dabo Hair (2 par mois au plus).';

    public const VERSION = '2026-11-28';

    /** Enregistre l'accord ou le retrait s'il change l'état actuel ; renvoie true si quelque chose a changé */
    public static function record(Customer $customer, bool $granted, string $source, ?User $by = null): bool
    {
        $changed = DB::transaction(function () use ($customer, $granted, $source, $by) {
            // Verrou sur la fiche, puis relecture : deux clics simultanés ne créent pas deux preuves (bug QA du 28 novembre 2026)
            $current = (bool) Customer::query()->whereKey($customer->getKey())->lockForUpdate()->value('marketing_consent');
            if ($current === $granted) {
                return false; // déjà dans cet état : pas de preuve en double
            }
            Customer::query()->whereKey($customer->getKey())->update(['marketing_consent' => $granted]);
            CustomerConsent::create(['customer_id' => $customer->id, 'channel' => self::CHANNEL, 'granted' => $granted, 'source' => $source,
                'text_version' => self::VERSION, 'recorded_by' => $by?->id]);

            return true;
        });
        $customer->forceFill(['marketing_consent' => $granted])->syncOriginalAttribute('marketing_consent');

        return $changed;
    }

    /** Dernière preuve (pour l'ERP et l'espace client) */
    public static function last(Customer $customer): ?CustomerConsent
    {
        return CustomerConsent::query()->where('customer_id', $customer->id)->where('channel', self::CHANNEL)->latest('id')->first();
    }

    /** Lien de désinscription à mettre en bas de chaque e-mail d'offre : signé, sans connexion */
    public static function unsubscribeUrl(Customer $customer): string
    {
        $signed = URL::signedRoute('offers.unsubscribe', ['customer' => $customer->getKey()], absolute: false);

        return rtrim((string) config('app.frontend_url'), '/').'/offres/desinscription'.substr($signed, strlen('/api/v1/offers/unsubscribe'));
    }
}
