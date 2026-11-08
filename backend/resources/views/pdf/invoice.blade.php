{{-- Facture PDF (dompdf). {{ }} échappe le HTML : aucune donnée saisie ne peut injecter du code (anti-XSS). --}}
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Facture {{ $invoice->number }}</title>
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
@php($company = $invoice->company_snapshot)
@php($fmt = fn ($n) => number_format($n, 0, ',', ' ').' F CFA')
<div class="header">
  <table class="cols"><tr>
    <td>
      <div class="brand">{{ $company['name'] ?? 'Dabo Hair' }}</div>
      <div class="muted">{{ $company['address'] ?? '' }}</div>
      <div class="muted">NINEA : {{ $company['ninea'] ?? '—' }} · RCCM : {{ $company['rccm'] ?? '—' }}</div>
    </td>
    <td class="right">
      <div style="font-size: 18px; font-weight: bold;">FACTURE</div>
      <div class="gold" style="font-size: 13px; font-weight: bold;">{{ $invoice->number }}</div>
      <div class="muted">Émise le {{ $invoice->issued_at->format('d/m/Y') }}</div>
      <div class="muted">Commande {{ $order->reference }}</div>
    </td>
  </tr></table>
</div>

<table class="cols" style="margin-bottom: 18px;"><tr>
  <td>
    <div class="muted" style="font-size: 9px; text-transform: uppercase;">Facturé à</div>
    <div style="font-weight: bold; font-size: 12px;">{{ $invoice->customer_name }}</div>
    <div>{{ $invoice->customer_phone }}</div>
    @if ($invoice->customer_email)<div>{{ $invoice->customer_email }}</div>@endif
    @if ($invoice->billing_address)<div>{{ $invoice->billing_address }}</div>@endif
  </td>
  <td class="right">
    <div class="muted" style="font-size: 9px; text-transform: uppercase;">Réception</div>
    <div>{{ match ($order->fulfillment_method->value) {
        'pickup' => 'Retrait en boutique',
        'pickup_point' => 'Point de retrait · '.($order->pickupPoint?->name ?? ''),
        default => 'Livraison · '.($order->deliveryZone?->name ?? ''),
    } }}</div>
    @foreach ($order->payments as $payment)
      <div class="muted">Payé le {{ $payment->paid_at?->format('d/m/Y') }} · {{ $payment->method->label() }}</div>
    @endforeach
  </td>
</tr></table>

<table class="items">
  <thead><tr><th>Désignation</th><th class="right">Prix unitaire</th><th class="right">Qté</th><th class="right">Total</th></tr></thead>
  <tbody>
  @foreach ($order->items as $item)
    <tr>
      <td>{{ $item->product_name }}</td>
      <td class="right">{{ $fmt($item->unit_price) }}</td>
      <td class="right">{{ $item->quantity }}</td>
      <td class="right">{{ $fmt($item->line_total) }}</td>
    </tr>
  @endforeach
  </tbody>
</table>

<table class="totals">
  <tr><td class="muted">Sous-total</td><td class="right">{{ $fmt($order->subtotal) }}</td></tr>
  @if ($order->discount_total)<tr><td class="muted">Remise</td><td class="right">- {{ $fmt($order->discount_total) }}</td></tr>@endif
  <tr><td class="muted">Livraison</td><td class="right">{{ $order->shipping_fee ? $fmt($order->shipping_fee) : 'Gratuite' }}</td></tr>
  <tr class="grand"><td>Total TTC</td><td class="right">{{ $fmt($invoice->total) }}</td></tr>
</table>

<div class="footer">{{ $company['name'] ?? 'Dabo Hair' }} · Facture {{ $invoice->number }} · Document généré automatiquement — toute correction donne lieu à un avoir.</div>
</body>
</html>
