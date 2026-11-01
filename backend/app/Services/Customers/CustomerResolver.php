<?php

namespace App\Services\Customers;

use App\Models\Customer;
use App\Models\User;
use App\Support\Phone;

/**
 * Trouve (ou crée) la fiche CLIENT d'une commande ou d'une réservation.
 * - Client connecté : sa propre fiche (créée au besoin).
 * - Invité : la fiche qui porte ce numéro de téléphone (évite les doublons, RG-CLI-01).
 *   On ne modifie PAS le nom d'une fiche existante : un invité ne doit pas pouvoir
 *   renommer le client d'un autre en tapant son numéro.
 */
class CustomerResolver
{
    /** @param array{first_name:string,last_name:string,phone:string,email:?string} $data */
    public function resolve(?User $user, array $data): Customer
    {
        $phone = Phone::normalize($data['phone']);

        if ($user) {
            return $user->customer ?? Customer::query()->updateOrCreate(
                ['phone' => $user->phone ?: $phone],
                ['user_id' => $user->id, 'first_name' => $user->first_name, 'last_name' => $user->last_name, 'email' => $user->email],
            );
        }

        return Customer::query()->firstOrCreate(
            ['phone' => $phone],
            ['first_name' => $data['first_name'], 'last_name' => $data['last_name'], 'email' => $data['email'] ?? null],
        );
    }
}
