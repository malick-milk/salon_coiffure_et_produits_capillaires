<?php

namespace App\Enums;

/** Canal de vente */
enum OrderChannel: string
{
    use HasValues;

    case Online = 'online';
    case Store = 'store';
}
