<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

/**
 * Créer le compte du PROPRIÉTAIRE en production (les comptes de démonstration n'y existent pas).
 * php artisan app:create-admin  → les informations sont demandées de façon interactive ;
 * le mot de passe n'apparaît ni à l'écran ni dans l'historique du terminal.
 */
class CreateAdminCommand extends Command
{
    protected $signature = 'app:create-admin';

    protected $description = 'Crée un compte administrateur (rôle super_admin)';

    public function handle(): int
    {
        $data = [
            'first_name' => $this->ask('Prénom'),
            'last_name' => $this->ask('Nom'),
            'email' => strtolower((string) $this->ask('Email')),
            'password' => $this->secret('Mot de passe (12 caractères minimum, lettres et chiffres)'),
        ];
        $validator = Validator::make($data, [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', Password::min(12)->letters()->numbers()],
        ]);
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        User::create($data)->assignRole('super_admin');
        $this->info("Administrateur {$data['email']} créé.");

        return self::SUCCESS;
    }
}
