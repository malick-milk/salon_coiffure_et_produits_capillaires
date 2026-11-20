<?php

namespace App\Services\Catalog;

use App\Models\Product;
use App\Models\Promotion;
use App\Models\User;

/**
 * PRIX PROMO (maquettes validées le 20 novembre 2026). Le prix du produit ne change jamais :
 * pendant les dates d'une promotion, le prix payé est calculé ici, au moment de la commande.
 */
class PromotionService
{
    /** Prix après remise, arrondi à la dizaine de francs INFÉRIEURE (4 167 F -> 4 160 F) */
    public static function discounted(int $price, int $percent): int
    {
        return intdiv(intdiv($price * (100 - $percent), 100), 10) * 10;
    }

    /** La promotion en cours pour ce produit (un produit n'est que dans une promotion à la fois), ou null */
    public function running(Product $product): ?Promotion
    {
        if ($product->relationLoaded('promotions')) { // liste du catalogue : déjà chargée, pas de requête par produit
            return $product->promotions->first(fn (Promotion $p) => $p->status() === 'current');
        }

        return $product->promotions()->running()->first();
    }

    /** La promotion qui s'applique à CETTE personne (une promo « membres » exige d'être connectée), ou null */
    public function applicable(Product $product, ?User $user): ?Promotion
    {
        $promotion = $this->running($product);

        return $promotion && ($promotion->audience === 'all' || $user !== null) ? $promotion : null;
    }
}
