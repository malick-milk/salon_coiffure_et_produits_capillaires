@props(['url'])
{{-- En-tête des e-mails aux couleurs de la boutique (maquette validée le 16 novembre 2026) :
     bandeau noir et logo en PNG (les messageries n'affichent pas le SVG). Le logo est servi par le site. --}}
<tr>
<td class="header" style="background-color: #0f0f0f;">
<a href="{{ $url }}" style="display: inline-block;">
<img src="{{ rtrim(config('app.frontend_url'), '/') }}/brand/logo-email.png" width="180" height="59" alt="{{ trim($slot) }}" style="display: block; border: 0; width: 180px; height: auto;">
</a>
{{-- Devise de Dabo Hair, sous le logo, sur le fond noir seulement (maquette validée le 27 novembre 2026) --}}
<p style="margin: 10px 0 0; text-align: center; font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.3; color: #d4af37;">Vos cheveux à l’état pur</p>
<p lang="en" style="margin: 2px 0 0; text-align: center; font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 13px; color: #a8a29e;">Your hair in the pure state.</p>
</td>
</tr>
