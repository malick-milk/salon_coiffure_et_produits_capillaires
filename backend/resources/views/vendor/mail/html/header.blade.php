@props(['url'])
{{-- En-tête des e-mails aux couleurs de la boutique (maquette validée le 16 novembre 2026) :
     bandeau noir et logo en PNG (les messageries n'affichent pas le SVG). Le logo est servi par le site. --}}
<tr>
<td class="header" style="background-color: #0f0f0f;">
<a href="{{ $url }}" style="display: inline-block;">
<img src="{{ rtrim(config('app.frontend_url'), '/') }}/brand/logo-email.png" width="180" height="59" alt="{{ trim($slot) }}" style="display: block; border: 0; width: 180px; height: auto;">
</a>
</td>
</tr>
