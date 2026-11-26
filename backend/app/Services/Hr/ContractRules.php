<?php

namespace App\Services\Hr;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\Employee;
use App\Models\EmploymentContract;
use Illuminate\Support\Carbon;

/**
 * RÈGLES DES CONTRATS (Code du travail du Sénégal, loi n° 2026-18 du 3 septembre 2026, JO n° 7931 du 17 septembre 2026).
 *
 * IMPORTANT : ces valeurs viennent de résumés publiés du nouveau Code (le texte officiel n'a pas pu être lu
 * depuis ce poste). Elles sont à CONFIRMER avec un comptable ou l'inspection du travail ; si un chiffre change,
 * on le modifie ICI seulement. Détail et sources : docs/15_RH_ET_IMPOTS.md.
 */
final class ContractRules
{
    /** Un CDD : 2 ans au plus (art. 100) */
    public const CDD_MAX_MONTHS = 24;

    /** Un seul renouvellement OU une seule prolongation (art. 100) */
    public const CDD_MAX_RENEWALS = 1;

    /** CDD cumulés avec le même employeur : 4 ans au plus (art. 100) ; au-delà, CDI de plein droit (art. 101) */
    public const CDD_MAX_TOTAL_MONTHS = 48;

    /** Indemnité de fin de CDD : 7 % de la rémunération brute (sauf exceptions, ex. CDI à la suite) — À CONFIRMER */
    public const END_OF_CDD_INDEMNITY_PERCENT = 7;

    /** Congés payés : 2 jours ouvrables par mois de service effectif (24 par an) — À CONFIRMER dans le nouveau Code */
    public const LEAVE_DAYS_PER_MONTH = 2;

    /** Prévenir avant la fin d'un CDD, d'un apprentissage, d'un stage */
    public const ALERT_DAYS = 30;

    /** Prévenir avant la fin de la période d'essai */
    public const TRIAL_ALERT_DAYS = 15;

    /**
     * Vérifie les dates d'un contrat. Retourne les erreurs (clé du champ → message), vide si tout va bien.
     *
     * @return array<string, string>
     */
    public static function termErrors(string $type, Carbon $startsOn, ?Carbon $endsOn, ?Carbon $trialEndsOn): array
    {
        $errors = [];
        $fixed = in_array($type, EmploymentContract::FIXED_TERM, true);
        if ($fixed && ! $endsOn) {
            $errors['ends_on'] = 'Indiquez la date de fin : un '.self::label($type).' a toujours une fin prévue.';
        }
        if (! $fixed && $endsOn) {
            $errors['ends_on'] = 'Un '.self::label($type).' n’a pas de date de fin prévue : laissez ce champ vide.';
        }
        if ($type === 'cdd' && $endsOn && $startsOn->copy()->addMonths(self::CDD_MAX_MONTHS)->lt($endsOn)) {
            $errors['ends_on'] = 'Un CDD dure '.(self::CDD_MAX_MONTHS / 12).' ans au plus (Code du travail, art. 100).';
        }
        if ($trialEndsOn && $trialEndsOn->lt($startsOn)) {
            $errors['trial_ends_on'] = 'La fin de la période d’essai doit suivre le début du contrat.';
        }
        if ($trialEndsOn && $endsOn && $trialEndsOn->gt($endsOn)) {
            $errors['trial_ends_on'] = 'La période d’essai ne peut pas dépasser la fin du contrat.';
        }

        return $errors;
    }

    /** Mois de CDD déjà faits avec ce même employeur (contrats terminés), pour la limite de 4 ans */
    public static function pastCddMonths(Employee $employee, ?int $exceptContractId = null): float
    {
        return $employee->contracts()->where('type', 'cdd')->when($exceptContractId, fn ($q, $id) => $q->whereKeyNot($id))->get()
            ->sum(fn (EmploymentContract $c) => $c->starts_on->diffInMonths($c->ended_on ?? $c->ends_on ?? now()));
    }

    /** Pourquoi on ne peut PAS renouveler ce CDD jusqu'à cette date (null = c'est possible) */
    public static function renewalRefusal(EmploymentContract $contract, Carbon $newEndsOn): ?string
    {
        if ($contract->type !== 'cdd' || $contract->ended_on) {
            return 'Seul un CDD en cours se renouvelle.';
        }
        if ($contract->renewal_count >= self::CDD_MAX_RENEWALS) {
            return 'Ce CDD a déjà été renouvelé une fois : la loi n’autorise qu’un seul renouvellement (art. 100). Passez en CDI ou terminez le contrat.';
        }
        if (! $contract->ends_on || $newEndsOn->lte($contract->ends_on)) {
            return 'La nouvelle date de fin doit être après la fin actuelle.';
        }
        $total = self::pastCddMonths($contract->employee, $contract->id) + $contract->starts_on->diffInMonths($newEndsOn);
        if ($total > self::CDD_MAX_TOTAL_MONTHS + 0.01) {
            return 'Avec ce renouvellement, les CDD dépasseraient '.(self::CDD_MAX_TOTAL_MONTHS / 12).' ans au total chez Dabo Hair (art. 100) : passez en CDI.';
        }

        return null;
    }

    /**
     * Ce qui demande une action, pour la liste et la fiche.
     *
     * @return list<array{kind: string, level: string, title: string, text: string, date: string|null}>
     */
    public static function alerts(EmploymentContract $c, ?Carbon $today = null): array
    {
        $today = ($today ?? now())->copy()->startOfDay();
        $name = $c->employee->fullName();
        $alerts = [];
        if ($c->ended_on) {
            return [];
        }
        if ($c->isFixedTerm() && $c->ends_on) {
            $days = (int) $today->diffInDays($c->ends_on, false);
            if ($days < 0) {
                $alerts[] = ['kind' => 'overdue', 'level' => 'danger', 'title' => 'Contrat arrivé à sa fin le '.self::date($c->ends_on),
                    'text' => $name.' travaille encore ? Un CDD qui continue après sa fin devient un CDI (art. 101). Choisissez : CDI ou fin du contrat.', 'date' => $c->ends_on->toDateString()];
            } elseif ($days <= self::ALERT_DAYS) {
                $what = $c->type === 'cdd' ? 'Fin de CDD' : 'Fin de contrat';
                $alerts[] = ['kind' => 'ending', 'level' => 'warning', 'title' => $what.($days === 0 ? ' aujourd’hui' : ' dans '.$days.' jour'.($days > 1 ? 's' : '')),
                    'text' => $name.', '.mb_strtolower($c->position).' : '.($c->type === 'cdd' && $c->renewal_count < self::CDD_MAX_RENEWALS ? 'renouveler (une seule fois), passer en CDI ou terminer' : 'passer en CDI ou terminer').' avant le '.self::date($c->ends_on).'.',
                    'date' => $c->ends_on->toDateString()];
            }
        }
        if ($c->trial_ends_on) {
            $days = (int) $today->diffInDays($c->trial_ends_on, false);
            if ($days >= 0 && $days <= self::TRIAL_ALERT_DAYS) {
                $alerts[] = ['kind' => 'trial', 'level' => 'warning', 'title' => 'Fin de période d’essai le '.self::date($c->trial_ends_on),
                    'text' => $name.', '.mb_strtolower($c->position).' : confirmer l’embauche ou y mettre fin avant cette date.', 'date' => $c->trial_ends_on->toDateString()];
            }
        }
        if (! $c->signed_on) {
            $alerts[] = ['kind' => 'unsigned', 'level' => 'danger', 'title' => 'Contrat non signé',
                'text' => $name.', '.mb_strtolower($c->position).' : le contrat signé n’est pas encore enregistré.', 'date' => null];
        }

        return $alerts;
    }

    /** Commission du mois : taux × prestations RÉALISÉES par sa fiche planning (prix figés des rendez-vous) */
    public static function commission(EmploymentContract $c, Carbon $month): array
    {
        $stylistId = $c->employee->stylist_id;
        $revenue = $stylistId ? (int) Booking::query()->where('stylist_id', $stylistId)->where('status', BookingStatus::Completed->value)
            ->whereBetween('starts_at', [$month->copy()->startOfMonth(), $month->copy()->endOfMonth()])->sum('price') : 0;
        $rate = (float) $c->commission_rate;

        return ['month' => $month->format('Y-m'), 'linked' => (bool) $stylistId, 'revenue' => $revenue, 'rate' => $rate,
            'commission' => (int) round($revenue * $rate / 100)];
    }

    /** Congés acquis cette année civile (mois de service effectif × 2 jours), et pris */
    public static function leaveBalance(Employee $employee, EmploymentContract $c, ?Carbon $today = null): array
    {
        $today = ($today ?? now())->copy();
        $from = $c->starts_on->copy()->max($today->copy()->startOfYear());
        $months = $from->gt($today) ? 0 : (int) floor($from->diffInMonths($today));
        $taken = (float) $employee->leaves()->where('kind', 'paid')->whereYear('starts_on', $today->year)->sum('days');

        return ['acquired' => $months * self::LEAVE_DAYS_PER_MONTH, 'taken' => $taken, 'per_month' => self::LEAVE_DAYS_PER_MONTH];
    }

    /** Estimation de l'indemnité de fin de CDD (7 % du brut versé, ici salaire fixe × mois) : à vérifier sur les vrais bulletins */
    public static function endOfCddIndemnity(EmploymentContract $c, Carbon $endOn): ?int
    {
        if ($c->type !== 'cdd' || ! $c->base_salary) {
            return null;
        }

        return (int) round($c->base_salary * $c->starts_on->diffInMonths($endOn) * self::END_OF_CDD_INDEMNITY_PERCENT / 100);
    }

    public static function label(string $type): string
    {
        return ['cdi' => 'CDI', 'cdd' => 'CDD', 'apprentissage' => 'contrat d’apprentissage', 'stage' => 'stage', 'prestataire' => 'contrat de prestation'][$type] ?? $type;
    }

    private static function date(Carbon $d): string
    {
        return $d->locale('fr')->isoFormat('D MMMM YYYY');
    }
}
