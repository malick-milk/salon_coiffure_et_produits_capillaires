{{-- Contrat de travail imprimable (module RH, 26 novembre 2026). MODÈLE : à faire relire avant signature. {{ }} échappe le HTML. --}}
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Contrat — {{ $employee->fullName() }}</title>
<style>
  @page { margin: 36px 48px; }
  body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #0F0F0F; line-height: 1.5; }
  .header { border-bottom: 3px solid #D4AF37; padding-bottom: 12px; margin-bottom: 18px; }
  .muted { color: #52525B; }
  h1 { font-size: 17px; text-align: center; margin: 6px 0 2px; }
  h2 { font-size: 12px; margin: 16px 0 4px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  .cols td { vertical-align: top; width: 50%; }
  .blank { color: #7A5A00; }
  .sign td { height: 90px; vertical-align: top; border-top: 1px solid #0F0F0F; padding-top: 6px; width: 50%; }
  .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8px; color: #52525B; }
</style>
</head>
<body>
@php($fmt = fn ($n) => $n !== null ? number_format($n, 0, ',', ' ').' F CFA' : '[à compléter]')
@php($d = fn ($date) => $date ? $date->format('d/m/Y') : '[à compléter]')
@php($b = fn ($v) => $v !== null && $v !== '' ? $v : '[à compléter]')
@php($titles = ['cdi' => 'CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE', 'cdd' => 'CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE', 'apprentissage' => 'CONTRAT D’APPRENTISSAGE', 'stage' => 'CONVENTION DE STAGE', 'prestataire' => 'CONTRAT DE PRESTATION DE SERVICES'])
@php($pay = ['cash' => 'en espèces', 'wave' => 'par Wave', 'orange_money' => 'par Orange Money', 'free_money' => 'par Free Money', 'bank' => 'par virement bancaire'])
<div class="header">
  <img src="data:image/png;base64,{{ base64_encode(file_get_contents(resource_path('images/logo-pdf.png'))) }}" alt="Dabo Hair" style="height: 60px;">
  <div class="muted">{{ $company['name'] ?? 'Dabo Hair' }} · {{ $company['address'] ?? '' }} · NINEA : {{ $company['ninea'] ?? '—' }} · RCCM : {{ $company['rccm'] ?? '—' }}</div>
</div>

<h1>{{ $titles[$contract->type] ?? 'CONTRAT' }}</h1>
<p class="muted" style="text-align:center;margin:0">Régi par le Code du travail du Sénégal (loi n° 2026-18 du 3 septembre 2026)@if($contract->type === 'prestataire') pour ce qui ne relève pas du droit commun des contrats @endif</p>

<h2>Entre les soussignés</h2>
<p><strong>{{ $company['name'] ?? 'Dabo Hair' }}</strong>, {{ $company['address'] ?? '' }}, représentée par sa gérante, ci-après « l’employeur »@if($contract->type === 'prestataire') (« le client »)@endif,</p>
<p>et <strong>{{ $employee->fullName() }}</strong>, né(e) le {{ $d($employee->birth_date) }}, demeurant {{ $b($employee->address) }}, CNI n° {{ $b($employee->id_number) }}, téléphone {{ $b($employee->phone) }},
ci-après @if($contract->type === 'prestataire') « le prestataire » @else « le salarié » @endif.</p>

<h2>1. Objet et poste</h2>
@if($contract->type === 'prestataire')
<p>Le prestataire réalise pour Dabo Hair des missions de <strong>{{ $contract->position }}</strong>. Il les organise librement, avec ses propres moyens, et peut travailler pour d’autres clients : il n’est pas soumis à un lien de subordination.</p>
@else
<p>Le salarié est engagé en qualité de <strong>{{ $contract->position }}</strong>, au salon Dabo Hair. Il exerce ses fonctions sous l’autorité de la gérante.</p>
@endif

<h2>2. Durée</h2>
@if($contract->type === 'cdi')
<p>Le présent contrat est conclu pour une durée indéterminée à compter du {{ $d($contract->starts_on) }}.</p>
@elseif($contract->type === 'cdd')
<p>Le présent contrat est conclu pour une durée déterminée, du {{ $d($contract->starts_on) }} au {{ $d($contract->ends_on) }}, pour le motif suivant : <span class="blank">[à compléter : surcroît d’activité, remplacement…]</span>.
Il ne peut être renouvelé ou prolongé qu’une seule fois ; la durée d’un CDD ne peut dépasser {{ $rules['cdd_months'] / 12 }} ans. À son terme, le salarié perçoit une indemnité de fin de contrat de {{ $rules['indemnity'] }} % de la rémunération brute perçue, sauf si un CDI lui fait suite.</p>
@elseif($contract->type === 'prestataire')
<p>Le présent contrat prend effet le {{ $d($contract->starts_on) }}, pour une durée indéterminée. Chaque partie peut y mettre fin par écrit, avec un délai de <span class="blank">[à compléter]</span> jours.</p>
@else
<p>Du {{ $d($contract->starts_on) }} au {{ $d($contract->ends_on) }}.</p>
@endif

@if($contract->trial_ends_on && $contract->type !== 'prestataire')
<h2>3. Période d’essai</h2>
<p>Le contrat ne devient définitif qu’à l’issue d’une période d’essai se terminant le {{ $d($contract->trial_ends_on) }}. Pendant cette période, chaque partie peut y mettre fin sans indemnité.</p>
@endif

<h2>{{ $contract->trial_ends_on && $contract->type !== 'prestataire' ? '4' : '3' }}. @if($contract->type === 'prestataire') Rémunération @else Temps de travail et rémunération @endif</h2>
@if($contract->type !== 'prestataire')
<p>Durée du travail : {{ $b($contract->weekly_hours) }} heures par semaine, jours de travail : {{ $b($contract->work_days) }}.</p>
@endif
<p>
@if($contract->type === 'apprentissage') Indemnité mensuelle d’apprentissage : @elseif($contract->type === 'prestataire') Rémunération : @else Salaire mensuel brut de base : @endif
<strong>{{ $fmt($contract->base_salary) }}</strong>@if((float) $contract->commission_rate > 0), auquel s’ajoute une commission de {{ rtrim(rtrim(number_format((float) $contract->commission_rate, 2, ',', ''), '0'), ',') }} % du prix des prestations réalisées par {{ $contract->type === 'prestataire' ? 'le prestataire' : 'le salarié' }} dans le mois (selon le planning du salon)@endif.
Paiement {{ $pay[$contract->pay_method] ?? '[mode de paiement à compléter]' }}, au plus tard le <span class="blank">[à compléter]</span> du mois suivant{{ $contract->type !== 'prestataire' ? ', avec remise d’un bulletin de paie' : '' }}.
</p>

@if($contract->type !== 'prestataire')
<h2>Congés, protection sociale</h2>
<p>Le salarié bénéficie des congés payés prévus par la loi ({{ $rules['leave'] }} jours ouvrables par mois de service effectif, sous réserve des textes en vigueur). Il est déclaré à l’IPRES (n° {{ $b($employee->ipres_number) }}) et à la Caisse de sécurité sociale (n° {{ $b($employee->css_number) }}).</p>
<h2>Obligations</h2>
<p>Le salarié respecte les règles d’hygiène du salon, le règlement intérieur, la discrétion sur les informations des clientes, et utilise le matériel du salon avec soin.</p>
@endif

<h2>Fin du contrat</h2>
<p>@if($contract->type === 'cdi') Chaque partie peut mettre fin au contrat dans les conditions prévues par le Code du travail, notamment le respect du préavis. @elseif($contract->type === 'prestataire') Voir l’article 2. @else Le contrat prend fin à la date prévue. Une rupture anticipée n’est possible que dans les cas prévus par le Code du travail. @endif</p>

<p style="margin-top:18px">Fait à Dakar, le <span class="blank">[date]</span>, en deux exemplaires originaux.</p>
<table class="sign" style="margin-top:12px"><tr>
  <td>Pour Dabo Hair, la gérante<br><span class="muted">« Lu et approuvé », signature</span></td>
  <td style="padding-left:24px">{{ $employee->fullName() }}<br><span class="muted">« Lu et approuvé », signature</span></td>
</tr></table>

<div class="footer">Modèle généré par l’ERP Dabo Hair. À faire relire par un comptable ou l’inspection du travail avant signature{{ $contract->type === 'cdd' ? ' ; le CDD est à déposer à l’inspection du travail avant son exécution (à confirmer)' : '' }}.</div>
</body>
</html>
