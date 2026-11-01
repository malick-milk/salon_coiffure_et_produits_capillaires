<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * Compte qui peut SE CONNECTER (client inscrit ou personnel).
 * HasRoles (spatie) : $user->hasPermissionTo('orders.update') — on vérifie des PERMISSIONS (ADR-004).
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable, SoftDeletes;

    /** Liste blanche des champs remplissables en masse (protection « mass assignment ») */
    protected $fillable = ['first_name', 'last_name', 'email', 'phone', 'password', 'is_active'];

    /** Jamais renvoyés en JSON */
    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed', // toute affectation est automatiquement hachée (bcrypt)
            'is_active' => 'boolean',
        ];
    }

    /** Fiche client métier associée (commandes, réservations) */
    public function customer(): HasOne
    {
        return $this->hasOne(Customer::class);
    }
}
