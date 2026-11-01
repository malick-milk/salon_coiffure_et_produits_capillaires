<?php

namespace App\Enums;

/** Cycle de vie d'une commande (RG-COM-01) */
enum OrderStatus: string
{
    use HasValues;

    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Preparing = 'preparing';
    case Ready = 'ready';
    case Shipped = 'shipped';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';
}
