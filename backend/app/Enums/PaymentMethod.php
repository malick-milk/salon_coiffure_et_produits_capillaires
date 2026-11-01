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

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Espèces', self::Wave => 'Wave', self::OrangeMoney => 'Orange Money',
            self::FreeMoney => 'Free Money', self::Card => 'Carte bancaire', self::BankTransfer => 'Virement',
        };
    }
}
