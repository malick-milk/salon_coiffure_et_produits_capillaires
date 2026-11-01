<?php

namespace App\Enums;

/** Statut de paiement d'une commande (RG-COM-07) */
enum PaymentStatus: string
{
    use HasValues;

    case Unpaid = 'unpaid';
    case Paid = 'paid';
    case Refunded = 'refunded';
}
