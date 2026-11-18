<?php

namespace App\Services\Catalog;

use App\Enums\OrderStatus;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;

/**
 * PRIX MEMBRE (lancement du 15 décembre 2026, maquettes validées le 18 novembre 2026).
 *
 * - Réservé à une cliente CONNECTÉE à son compte ; sans compte, on paie le prix normal.
 * - Limité : member_price_limit unités au prix membre (ex. 20 gammes), toutes clientes confondues.
 * - UNE unité au prix membre par compte.
 * - Une commande annulée rend sa place (elle ne compte plus).
 * C'est le SERVEUR qui décide : le navigateur affiche, mais le prix facturé est calculé ici.
 */
class MemberPriceService
{
    public function hasOffer(Product $product): bool
    {
        return $product->member_price !== null && $product->member_price_limit !== null;
    }

    /** Unités déjà vendues au prix membre (commandes annulées exclues) */
    public function used(Product $product): int
    {
        return (int) OrderItem::query()->where('product_id', $product->id)->whereNotNull('regular_unit_price')
            ->whereHas('order', fn ($q) => $q->where('status', '!=', OrderStatus::Cancelled->value))
            ->sum('quantity');
    }

    /** Places restantes au prix membre, ou null s'il n'y a pas d'offre */
    public function remaining(Product $product): ?int
    {
        return $this->hasOffer($product) ? max(0, (int) $product->member_price_limit - $this->used($product)) : null;
    }

    /** Ce compte a-t-il déjà acheté ce produit au prix membre ? */
    public function alreadyUsedBy(User $user, Product $product): bool
    {
        return OrderItem::query()->where('product_id', $product->id)->whereNotNull('regular_unit_price')
            ->whereHas('order', fn ($q) => $q->where('status', '!=', OrderStatus::Cancelled->value)
                ->whereHas('customer', fn ($c) => $c->where('user_id', $user->id)))
            ->exists();
    }

    /**
     * Pourquoi cette personne a (ou n'a pas) le prix membre :
     * eligible | sign_in (pas connectée) | already_used (déjà acheté) | sold_out (les 20 sont parties) | none (pas d'offre)
     */
    public function status(?User $user, Product $product): string
    {
        return match (true) {
            ! $this->hasOffer($product) => 'none',
            $this->remaining($product) === 0 => 'sold_out',
            $user === null => 'sign_in',
            $this->alreadyUsedBy($user, $product) => 'already_used',
            default => 'eligible',
        };
    }
}
