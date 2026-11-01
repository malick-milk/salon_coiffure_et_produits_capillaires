<?php

namespace App\Enums;

/**
 * Cycle de vie d'une commande (RG-COM-01), sous forme de MACHINE À ÉTATS :
 * seules les transitions listées dans transitions() sont autorisées.
 */
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

    /** @return list<self> états accessibles depuis l'état actuel */
    public function transitions(FulfillmentMethod $method): array
    {
        return match ($this) {
            self::Pending => [self::Confirmed, self::Cancelled],
            self::Confirmed => [self::Preparing, self::Cancelled],
            // Retrait : « prête à retirer » ; livraison : « en livraison »
            self::Preparing => [$method === FulfillmentMethod::Pickup ? self::Ready : self::Shipped, self::Cancelled],
            self::Ready, self::Shipped => [self::Delivered],
            self::Delivered, self::Cancelled => [], // états finaux
        };
    }

    public function canTransitionTo(self $next, FulfillmentMethod $method): bool
    {
        return in_array($next, $this->transitions($method), true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'En attente', self::Confirmed => 'Confirmée', self::Preparing => 'En préparation',
            self::Ready => 'Prête à retirer', self::Shipped => 'En livraison', self::Delivered => 'Livrée', self::Cancelled => 'Annulée',
        };
    }
}
