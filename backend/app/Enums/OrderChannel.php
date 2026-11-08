<?php

namespace App\Enums;

/** Canal de vente */
enum OrderChannel: string
{
    use HasValues;

    case Online = 'online';
    case Store = 'store';
    case Partner = 'partner'; // étape 14 : ventes au comptoir d'un point de retrait, constatées au relevé
}
