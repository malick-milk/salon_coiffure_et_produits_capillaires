<?php

use App\Exceptions\InsufficientStockException;
use App\Exceptions\SlotUnavailableException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Spatie\Permission\Exceptions\UnauthorizedException;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum en mode SPA : les requêtes venant du frontend (SANCTUM_STATEFUL_DOMAINS)
        // sont authentifiées par cookie de session + protection CSRF (ADR-003)
        $middleware->statefulApi();

        // Middlewares de spatie/laravel-permission : ->middleware('permission:orders.manage') sur une route
        $middleware->alias([
            'permission' => PermissionMiddleware::class,
            'role' => RoleMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Messages d'erreur de l'API en français, au format du contrat : { "message": "…" }.
        // En production, jamais de détail technique (trace, requête SQL) dans la réponse.
        // Exceptions MÉTIER -> 409 Conflit, au format attendu par le frontend
        $exceptions->render(fn (SlotUnavailableException $e) => response()->json(['message' => $e->getMessage()], 409));
        $exceptions->render(fn (InsufficientStockException $e) => response()->json(['message' => $e->getMessage(), 'items' => $e->items], 409));

        // Permission manquante (spatie) : 403 au même format que les autres erreurs
        $exceptions->render(function (UnauthorizedException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Vous n’avez pas la permission d’effectuer cette action.'], 403);
            }
        });
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Non authentifié.'], 401);
            }
        });
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Ressource introuvable.'], 404);
            }
        });
        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return match ($e->getStatusCode()) {
                403 => response()->json(['message' => 'Accès refusé.'], 403),
                419 => response()->json(['message' => 'Session expirée. Rechargez la page.'], 419),
                429 => response()->json(['message' => 'Trop de requêtes. Réessayez dans un instant.'], 429, $e->getHeaders()),
                default => null, // les autres erreurs HTTP gardent leur message (abort(422, '…'))
            };
        });
    })->create();
