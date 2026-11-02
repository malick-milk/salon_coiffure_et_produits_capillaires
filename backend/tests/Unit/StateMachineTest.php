<?php

namespace Tests\Unit;

use App\Enums\BookingStatus;
use App\Enums\FulfillmentMethod;
use App\Enums\OrderStatus;
use PHPUnit\Framework\TestCase;

/**
 * TEST UNITAIRE : on teste une classe seule, sans base de données ni HTTP.
 * D'où « PHPUnit\Framework\TestCase » (et non Tests\TestCase, qui démarre Laravel et remplit la base) :
 * ces tests s'exécutent en quelques millisecondes.
 */
class StateMachineTest extends TestCase
{
    public function test_une_commande_en_retrait_passe_par_prete_et_non_par_en_livraison(): void
    {
        $this->assertTrue(OrderStatus::Preparing->canTransitionTo(OrderStatus::Ready, FulfillmentMethod::Pickup));
        $this->assertFalse(OrderStatus::Preparing->canTransitionTo(OrderStatus::Shipped, FulfillmentMethod::Pickup));
    }

    public function test_une_commande_en_livraison_passe_par_en_livraison(): void
    {
        $this->assertTrue(OrderStatus::Preparing->canTransitionTo(OrderStatus::Shipped, FulfillmentMethod::Delivery));
        $this->assertFalse(OrderStatus::Preparing->canTransitionTo(OrderStatus::Ready, FulfillmentMethod::Delivery));
    }

    public function test_on_ne_saute_pas_d_etape_et_on_ne_revient_pas_en_arriere(): void
    {
        $this->assertFalse(OrderStatus::Confirmed->canTransitionTo(OrderStatus::Delivered, FulfillmentMethod::Pickup));
        $this->assertFalse(OrderStatus::Ready->canTransitionTo(OrderStatus::Preparing, FulfillmentMethod::Pickup));
    }

    public function test_une_commande_remise_au_client_ne_peut_plus_etre_annulee(): void
    {
        $this->assertFalse(OrderStatus::Ready->canTransitionTo(OrderStatus::Cancelled, FulfillmentMethod::Pickup));
        $this->assertFalse(OrderStatus::Shipped->canTransitionTo(OrderStatus::Cancelled, FulfillmentMethod::Delivery));
    }

    public function test_livree_et_annulee_sont_des_etats_finaux(): void
    {
        foreach (FulfillmentMethod::cases() as $method) {
            $this->assertSame([], OrderStatus::Delivered->transitions($method));
            $this->assertSame([], OrderStatus::Cancelled->transitions($method));
        }
    }

    public function test_un_rendez_vous_doit_etre_confirme_avant_d_etre_termine(): void
    {
        $this->assertFalse(BookingStatus::Pending->canTransitionTo(BookingStatus::Completed));
        $this->assertTrue(BookingStatus::Confirmed->canTransitionTo(BookingStatus::Completed));
        $this->assertTrue(BookingStatus::Confirmed->canTransitionTo(BookingStatus::NoShow));
    }

    public function test_un_rendez_vous_termine_annule_ou_absent_est_final(): void
    {
        foreach ([BookingStatus::Completed, BookingStatus::Cancelled, BookingStatus::NoShow] as $final) {
            $this->assertSame([], $final->transitions(), $final->value);
        }
    }
}
