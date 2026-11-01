<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /** Avant chaque test : base recréée puis remplie avec les seeders (données identiques à la démo) */
    protected bool $seed = true;

    protected function setUp(): void
    {
        parent::setUp();
        // Les requêtes « viennent » du frontend : Sanctum les traite en mode SPA (session + cookie)
        $this->withHeaders(['Referer' => 'http://localhost:5173/', 'Origin' => 'http://localhost:5173']);
    }
}
