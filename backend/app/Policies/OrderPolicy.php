<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;

/**
 * Autorisations sur une commande (OWASP A01 : contrôle d'accès).
 * Connaître la référence d'une commande ne suffit PAS : il faut en être le propriétaire,
 * ou avoir la permission orders.view (personnel de l'ERP).
 */
class OrderPolicy
{
    public function view(User $user, Order $order): bool
    {
        return $order->customer?->user_id === $user->id || $user->can('orders.view');
    }
}
