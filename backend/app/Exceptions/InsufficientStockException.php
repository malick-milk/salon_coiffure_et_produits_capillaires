<?php

namespace App\Exceptions;

use RuntimeException;

/** Levée quand une sortie de stock dépasse la quantité disponible (RG-STK-01) */
class InsufficientStockException extends RuntimeException
{
    /** @param list<array{product_id:int,name:string,requested:int,available:int}> $items */
    public function __construct(public readonly array $items)
    {
        parent::__construct('Stock insuffisant pour certains produits.');
    }
}
