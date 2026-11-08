{{-- Relevé mensuel d'un point de retrait (étape 14) : comptage, ventes, commission, montant dû. --}}
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Relevé {{ $statement->number }}</title>
<style>
  @page { margin: 32px 40px; }
  body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #0F0F0F; }
  .header { border-bottom: 3px solid #D4AF37; padding-bottom: 14px; margin-bottom: 20px; }
  .brand { font-size: 22px; font-weight: bold; color: #0F0F0F; }
  .gold { color: #7A5A00; }
  .muted { color: #52525B; }
  table { width: 100%; border-collapse: collapse; }
  .cols td { vertical-align: top; width: 50%; }
  .items th { background: #0F0F0F; color: #F8F8F8; text-align: left; padding: 7px 8px; font-size: 10px; text-transform: uppercase; }
  .items td { padding: 7px 8px; border-bottom: 1px solid #E4E4E7; }
  .right, .items th.right { text-align: right; } /* .items th.right : plus spécifique que .items th */
  .totals { width: 45%; margin-left: 55%; margin-top: 14px; }
  .totals td { padding: 5px 8px; }
  .grand td { font-size: 14px; font-weight: bold; border-top: 2px solid #0F0F0F; }
  .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #52525B; }
</style>
</head>
<body>
@php($fmt = fn ($n) => number_format($n, 0, ',', ' ').' F CFA')
@php($point = $statement->pickupPoint)
<div class="header">
  <table class="cols"><tr>
    <td>
      <div class="brand">{{ $company['name'] ?? 'Dabo Hair' }}</div>
      <div class="muted">{{ $company['address'] ?? '' }}</div>
      <div class="muted">NINEA : {{ $company['ninea'] ?? '—' }} · RCCM : {{ $company['rccm'] ?? '—' }}</div>
    </td>
    <td class="right">
      <div style="font-size: 18px; font-weight: bold;">RELEVÉ MENSUEL</div>
      <div class="gold" style="font-size: 13px; font-weight: bold;">{{ $statement->number }}</div>
      <div class="muted">Mois de {{ \Carbon\Carbon::createFromFormat('Y-m', $statement->period)->locale('fr')->isoFormat('MMMM YYYY') }} · validé le {{ $statement->created_at->format('d/m/Y') }}</div>
    </td>
  </tr></table>
</div>
<table class="cols" style="margin-bottom: 18px;"><tr>
  <td>
    <div class="muted" style="font-size: 9px; text-transform: uppercase;">Point de retrait partenaire</div>
    <div style="font-weight: bold; font-size: 12px;">{{ $point->name }}</div>
    <div>{{ $point->owner_name }} · {{ $point->phone }}</div>
    <div>{{ $point->address }}, {{ $point->city }}</div>
  </td>
  <td class="right">
    <div class="muted" style="font-size: 9px; text-transform: uppercase;">Conditions</div>
    <div>Dépôt-vente : les produits restent à Dabo Hair jusqu’à leur vente</div>
    <div>Prix de vente imposé : prix du site · commission {{ rtrim(rtrim(number_format((float) ($statement ?? $point)->commission_rate, 2, ',', ''), '0'), ',') }} %</div>
    <div>Relevé mensuel, versement au plus tard le 5</div>
  </td>
</tr></table>

<table class="items">
  <thead><tr><th>Produit</th><th class="right">Prix</th><th class="right">Attendu</th><th class="right">Compté</th><th class="right">Abîmés</th><th class="right">Comptoir</th><th class="right">En ligne</th><th class="right">Montant</th></tr></thead>
  <tbody>
  @foreach ($statement->items as $i)
    <tr><td>{{ $i->product_name }}</td><td class="right">{{ number_format($i->unit_price, 0, ',', ' ') }}</td><td class="right">{{ $i->expected_qty }}</td><td class="right">{{ $i->counted_qty }}</td><td class="right">{{ $i->damaged_qty }}</td><td class="right">{{ $i->counter_sold_qty }}</td><td class="right">{{ $i->online_qty }}</td><td class="right">{{ $fmt(($i->counter_sold_qty + $i->online_qty) * $i->unit_price) }}</td></tr>
  @endforeach
  </tbody>
</table>
<table class="totals">
  <tr><td>Ventes au comptoir</td><td class="right">{{ $fmt($statement->counter_sales_total) }}</td></tr>
  <tr><td>Commandes en ligne remises</td><td class="right">{{ $fmt($statement->online_sales_total) }}</td></tr>
  <tr><td><strong>Total encaissé par le partenaire</strong></td><td class="right"><strong>{{ $fmt($statement->sales_total) }}</strong></td></tr>
  <tr><td>Commission ({{ rtrim(rtrim(number_format((float) $statement->commission_rate, 2, ',', ''), '0'), ',') }} %)</td><td class="right">{{ $fmt($statement->commission_gross) }}</td></tr>
  @if ($statement->damaged_value > 0)
  <tr><td>Abîmés / perdus déduits</td><td class="right">− {{ $fmt(min($statement->damaged_value, $statement->commission_gross)) }}</td></tr>
  @endif
  <tr><td>Commission nette du partenaire</td><td class="right">{{ $fmt($statement->commission_net) }}</td></tr>
  <tr class="grand"><td>À verser avant le {{ $statement->due_date->format('d/m/Y') }}</td><td class="right">{{ $fmt($statement->amount_due) }}</td></tr>
</table>
@if ($statement->declared_sold !== null)
<p style="margin-top: 18px;">Déclaré par le partenaire : {{ $statement->declared_sold }} produit(s) vendu(s).@if ($statement->gap_note) Écart expliqué : {{ $statement->gap_note }}@endif</p>
@endif
@if ($statement->paid_at)
<p class="gold" style="font-weight: bold;">Versement reçu le {{ $statement->paid_at->format('d/m/Y') }}. Les factures des ventes sont émises.</p>
@endif
<table class="cols" style="margin-top: 50px;"><tr>
  <td><div style="border-top: 1px solid #A1A1AA; padding-top: 6px; width: 80%;" class="muted">Pour Dabo Hair</div></td>
  <td><div style="border-top: 1px solid #A1A1AA; padding-top: 6px; width: 80%; margin-left: 20%;" class="muted">Le partenaire (signature, « lu et approuvé »)</div></td>
</tr></table>
<div class="footer">{{ $company['name'] ?? 'Dabo Hair' }} · Relevé {{ $statement->number }}</div>
</body>
</html>
