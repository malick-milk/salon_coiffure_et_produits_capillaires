<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /** Avant chaque test : base recréée puis remplie avec les seeders (données identiques à la démo) */
    protected bool $seed = true;
}
