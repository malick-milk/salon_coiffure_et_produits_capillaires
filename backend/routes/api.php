<?php

use App\Http\Controllers\Api\V1\CatalogController;
use App\Http\Controllers\Api\V1\SalonController;
use Illuminate\Support\Facades\Route;

/*
| API v1 (contrat : frontend/src/types/api.ts, API_DOCUMENTATION.md).
| Toutes ces routes sont préfixées par /api : /api/v1/products…
| throttle:api = limitation de débit (anti-abus), configurée dans AppServiceProvider.
*/
Route::prefix('v1')->middleware('throttle:api')->group(function () {
    // Catalogue
    Route::get('categories', [CatalogController::class, 'categories']);
    Route::get('products', [CatalogController::class, 'products']);
    Route::get('products/{slug}', [CatalogController::class, 'product']);

    // Salon
    Route::get('services', [SalonController::class, 'services']);
    Route::get('stylists', [SalonController::class, 'stylists']);
    Route::get('business-hours', [SalonController::class, 'businessHours']);
    Route::get('availability', [SalonController::class, 'availability']);
    Route::get('delivery-zones', [SalonController::class, 'deliveryZones']);

    // Étape 6.2 : réservations, authentification, commandes, espace client
});
