<?php

namespace App\Enums;

/** D'où vient le stock d'un produit : de la fabrication Dabo Hair ou d'un achat chez un fournisseur */
enum ProductOrigin: string
{
    use HasValues;

    case Made = 'made';     // fabriqué par Dabo Hair : le stock entre par un lot de fabrication
    case Resold = 'resold'; // acheté et revendu : le stock entre par une réception d'achat
}
