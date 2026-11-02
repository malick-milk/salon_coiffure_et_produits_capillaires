<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BookingController;
use App\Http\Controllers\Api\V1\Admin\BookingAdminController;
use App\Http\Controllers\Api\V1\Admin\CatalogAdminController;
use App\Http\Controllers\Api\V1\Admin\CustomerAdminController;
use App\Http\Controllers\Api\V1\Admin\DashboardController;
use App\Http\Controllers\Api\V1\Admin\OrderAdminController;
use App\Http\Controllers\Api\V1\Admin\AnalyticsController;
use App\Http\Controllers\Api\V1\Admin\TeamAdminController;
use App\Http\Controllers\Api\V1\CatalogController;
use App\Http\Controllers\Api\V1\InvoiceController;
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
        Route::get('me/orders/{reference}/invoice', [InvoiceController::class, 'forCustomer']);

        /*
        | ERP : chaque route exige une PERMISSION précise (jamais un nom de rôle, ADR-004).
        | Un client connecté reçoit 403 ; un caissier n'accède pas à la gestion des utilisateurs, etc.
        */
        Route::prefix('admin')->group(function () {
            Route::get('dashboard', DashboardController::class)->middleware('permission:orders.view');

            Route::middleware('permission:orders.view')->group(function () {
                Route::get('orders', [OrderAdminController::class, 'index']);
                Route::get('orders/{reference}', [OrderAdminController::class, 'show']);
            });
            Route::middleware('permission:orders.manage')->group(function () {
                Route::patch('orders/{reference}/status', [OrderAdminController::class, 'updateStatus']);
                Route::post('orders/{reference}/payments', [OrderAdminController::class, 'recordPayment']);
            });
            Route::get('invoices/{number}/pdf', [InvoiceController::class, 'forStaff'])->middleware('permission:invoices.view');

            Route::get('bookings', [BookingAdminController::class, 'index'])->middleware('permission:bookings.view');
            Route::patch('bookings/{reference}/status', [BookingAdminController::class, 'updateStatus'])->middleware('permission:bookings.manage');

            Route::get('products', [CatalogAdminController::class, 'products'])->middleware('permission:products.view');
            Route::patch('products/{product}', [CatalogAdminController::class, 'updateProduct'])->middleware('permission:products.manage');
            Route::get('products/{product}/movements', [CatalogAdminController::class, 'movements'])->middleware('permission:stock.view');
            Route::post('products/{product}/stock-adjustments', [CatalogAdminController::class, 'adjustStock'])->middleware('permission:stock.adjust');
            Route::get('production-batches', [CatalogAdminController::class, 'batches'])->middleware('permission:stock.view');
            Route::post('production-batches', [CatalogAdminController::class, 'storeBatch'])->middleware('permission:production.manage');

            Route::get('customers', [CustomerAdminController::class, 'index'])->middleware('permission:customers.view');

            Route::middleware('permission:users.manage')->group(function () {
                Route::get('users', [TeamAdminController::class, 'users']);
                Route::post('users', [TeamAdminController::class, 'storeUser']);
                Route::patch('users/{user}', [TeamAdminController::class, 'updateUser']);
                Route::get('roles', [TeamAdminController::class, 'roles']);
            });
            Route::get('audit', [TeamAdminController::class, 'audit'])->middleware('permission:audit.view');

            // Étape 8 : tableau de bord décisionnel (BI) et exports CSV, réservés au propriétaire
            Route::middleware('permission:analytics.view')->group(function () {
                Route::get('analytics', [AnalyticsController::class, 'overview']);
                Route::get('analytics/export/{dataset}', [AnalyticsController::class, 'export'])->middleware('throttle:20,1');
            });
        });
    });
});
