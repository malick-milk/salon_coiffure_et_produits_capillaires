<?php

namespace App\Enums;

/** Mode de réception : retrait au salon, livraison, ou retrait dans un point partenaire */
enum FulfillmentMethod: string
{
    use HasValues;

    case Pickup = 'pickup';
    case Delivery = 'delivery';
    case PickupPoint = 'pickup_point'; // étape 14 : retrait dans une boutique partenaire de la région
}
