<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BookingController;
use App\Http\Controllers\Api\V1\CatalogController;
use App\Http\Controllers\Api\V1\Me\AccountController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\SalonController;
use Illuminate\Support\Facades\Route;

/*
| API v1 (contrat : frontend/src/types/api.ts, API_DOCUMENTATION.md).
| Toutes ces routes sont préfixées par /api : /api/v1/products…
| throttle:* = limitations de débit (anti-abus), définies dans AppServiceProvider.
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

    // Réservations et commandes : avec ou sans compte, avec une limite anti-abus plus stricte (RG-RES-07)
    Route::post('bookings', [BookingController::class, 'store'])->middleware('throttle:checkout');
    Route::post('orders', [OrderController::class, 'store'])->middleware('throttle:checkout');

    // Authentification (la limite des 5 essais est gérée dans le contrôleur, par email + IP)
    Route::post('auth/login', [AuthController::class, 'login']);
    Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:checkout');

    // Routes protégées : 401 si l'utilisateur n'est pas connecté
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);

        Route::get('me/orders', [AccountController::class, 'orders']);
        Route::get('me/orders/{reference}', [AccountController::class, 'order']);
        Route::get('me/bookings', [AccountController::class, 'bookings']);
        Route::post('me/bookings/{reference}/cancel', [AccountController::class, 'cancelBooking']);
        Route::patch('me/profile', [AccountController::class, 'updateProfile']);
    });
});
