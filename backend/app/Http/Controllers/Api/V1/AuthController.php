<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\Customer;
use App\Models\User;
use App\Support\SecurityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Authentification Sanctum en mode SPA (ADR-003) : session dans un cookie HttpOnly, protection CSRF.
 * Spécification : frontend/src/mocks/handlers-account.ts.
 */
class AuthController extends Controller
{
    private const MAX_ATTEMPTS = 5; // RG-SEC-02

    private const LOCK_SECONDS = 60;

    public function login(LoginRequest $request): UserResource|JsonResponse
    {
        $email = mb_strtolower(trim($request->string('email')->toString()));
        $key = 'login:'.$email.'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            SecurityLog::event('login.locked', $request, ['email' => SecurityLog::maskEmail($email)]);

            return response()->json(['message' => 'Trop de tentatives. Réessayez dans une minute.'], 429);
        }

        $credentials = ['email' => $email, 'password' => $request->string('password')->toString(), 'is_active' => true];
        if (! Auth::guard('web')->attempt($credentials, $request->boolean('remember'))) {
            RateLimiter::hit($key, self::LOCK_SECONDS);
            SecurityLog::event('login.failed', $request, ['email' => SecurityLog::maskEmail($email), 'attempts' => RateLimiter::attempts($key)]);
            // Message VAGUE : on ne révèle pas si l'email existe (anti-énumération des comptes)
            throw ValidationException::withMessages(['email' => 'Ces identifiants ne correspondent à aucun compte.']);
        }

        RateLimiter::clear($key);
        $request->session()->regenerate(); // nouvel identifiant de session : protection contre la fixation de session
        $user = $request->user();
        $user->forceFill(['last_login_at' => now()])->save();
        if ($user->getAllPermissions()->isNotEmpty()) { // connexion du PERSONNEL : accès à l'ERP, on la trace
            SecurityLog::event('login.staff', $request, ['email' => SecurityLog::maskEmail($email)], 'info');
        }

        return new UserResource($user);
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = DB::transaction(function () use ($data) {
            $user = User::create([...collect($data)->only(['first_name', 'last_name', 'email', 'phone', 'password'])->all()]);
            $user->assignRole('customer');
            // RG-RES-08 : un invité qui crée son compte retrouve ses commandes et réservations passées
            $customer = Customer::query()->where('phone', $data['phone'])->whereNull('user_id')->first();
            $customer
                ? $customer->update(['user_id' => $user->id, 'email' => $data['email']])
                : Customer::create(['user_id' => $user->id, 'first_name' => $data['first_name'], 'last_name' => $data['last_name'], 'phone' => $data['phone'], 'email' => $data['email']]);

            return $user;
        });

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function logout(Request $request): Response
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();      // la session est détruite côté serveur
        $request->session()->regenerateToken(); // nouveau jeton CSRF

        return response()->noContent();
    }

    public function me(Request $request): JsonResponse
    {
        // Statut 200 forcé : juste après une inscription, Laravel répondrait « 201 Created »
        // (le modèle vient d'être créé dans le même cycle), ce qui n'a pas de sens pour une lecture
        return (new UserResource($request->user()))->response()->setStatusCode(200);
    }
}
