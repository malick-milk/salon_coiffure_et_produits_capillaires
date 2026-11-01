<?php

namespace App\Enums;

/** Postes de coût d'un lot de fabrication */
enum ProductionCostCategory: string
{
    use HasValues;

    case Ingredients = 'ingredients';
    case Packaging = 'packaging';
    case Labels = 'labels';
    case Labor = 'labor';
    case Other = 'other';
}
