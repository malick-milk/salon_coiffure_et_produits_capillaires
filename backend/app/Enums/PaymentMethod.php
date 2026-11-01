<?php

namespace App\Enums;

/** Moyens de paiement (Wave, Orange Money… prêts pour l'intégration, ADR-007) */
enum PaymentMethod: string
{
    use HasValues;

    case Cash = 'cash';
    case Wave = 'wave';
    case OrangeMoney = 'orange_money';
    case FreeMoney = 'free_money';
    case Card = 'card';
    case BankTransfer = 'bank_transfer';
}
