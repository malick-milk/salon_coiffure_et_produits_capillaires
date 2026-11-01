<?php

namespace App\Enums;

/** Type de mouvement du grand livre de stock (ADR-006) */
enum StockMovementType: string
{
    use HasValues;

    case Initial = 'initial';
    case Production = 'production';
    case Purchase = 'purchase';
    case Sale = 'sale';
    case SaleCancellation = 'sale_cancellation';
    case CustomerReturn = 'customer_return';
    case Loss = 'loss';
    case Adjustment = 'adjustment';
}
