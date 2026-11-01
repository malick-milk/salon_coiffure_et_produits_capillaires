<?php

namespace App\Enums;

/** Type de client : particulier ou revendeur (vente en gros) */
enum CustomerType: string
{
    use HasValues;

    case Individual = 'individual';
    case Reseller = 'reseller';
}
