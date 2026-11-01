<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** L'utilisateur connecté (types/api.ts → User). Jamais le mot de passe ni le jeton « remember » */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'roles' => $this->getRoleNames()->values(),
            // Le frontend s'en sert pour AFFICHER les menus de l'ERP (confort) ;
            // chaque route de l'API revérifie la permission (sécurité)
            'permissions' => $this->getAllPermissions()->pluck('name')->sort()->values(),
        ];
    }
}
