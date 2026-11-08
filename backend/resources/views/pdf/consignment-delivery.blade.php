{{-- Bon de dépôt (étape 14) : prouve ce que le partenaire a reçu. {{ }} échappe le HTML (anti-XSS). --}}
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Bon de dépôt {{ $delivery->number }}</title>
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
@php($point = $delivery->pickupPoint)
<div class="header">
  <table class="cols"><tr>
    <td>
      <div class="brand">{{ $company['name'] ?? 'Dabo Hair' }}</div>
      <div class="muted">{{ $company['address'] ?? '' }}</div>
      <div class="muted">NINEA : {{ $company['ninea'] ?? '—' }} · RCCM : {{ $company['rccm'] ?? '—' }}</div>
    </td>
    <td class="right">
      <div style="font-size: 18px; font-weight: bold;">BON DE DÉPÔT</div>
      <div class="gold" style="font-size: 13px; font-weight: bold;">{{ $delivery->number }}</div>
      <div class="muted">Livré le {{ $delivery->delivered_on->format('d/m/Y') }}</div>
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
  <thead><tr><th>Produit</th><th class="right">Prix du site</th><th class="right">Quantité</th><th class="right">Valeur</th></tr></thead>
  <tbody>
  @foreach ($delivery->items as $item)
    <tr><td>{{ $item->product_name }}</td><td class="right">{{ $fmt($item->unit_price) }}</td><td class="right">{{ $item->quantity }}</td><td class="right">{{ $fmt($item->line_total) }}</td></tr>
  @endforeach
  </tbody>
</table>
<table class="totals">
  <tr><td>Produits confiés</td><td class="right">{{ $delivery->total_quantity }}</td></tr>
  <tr class="grand"><td>Valeur confiée</td><td class="right">{{ $fmt($delivery->total_value) }}</td></tr>
</table>
<p style="margin-top: 24px; line-height: 1.6;">Ce bon n’est pas une facture : les produits ci-dessus sont confiés au partenaire et restent la propriété de Dabo Hair jusqu’à leur vente, au prix affiché sur le site. Tout produit abîmé ou perdu est déduit de la commission du partenaire.</p>
<table class="cols" style="margin-top: 50px;"><tr>
  <td><div style="border-top: 1px solid #A1A1AA; padding-top: 6px; width: 80%;" class="muted">Pour Dabo Hair</div></td>
  <td><div style="border-top: 1px solid #A1A1AA; padding-top: 6px; width: 80%; margin-left: 20%;" class="muted">Le partenaire (signature, « lu et approuvé »)</div></td>
</tr></table>
<div class="footer">{{ $company['name'] ?? 'Dabo Hair' }} · Bon de dépôt {{ $delivery->number }}</div>
</body>
</html>
