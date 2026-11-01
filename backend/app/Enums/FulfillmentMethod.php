<?php

namespace App\Enums;

/** Mode de réception : retrait en boutique ou livraison */
enum FulfillmentMethod: string
{
    use HasValues;

    case Pickup = 'pickup';
    case Delivery = 'delivery';
}
