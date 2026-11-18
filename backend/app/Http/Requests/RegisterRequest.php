<?php

namespace App\Http\Requests;

use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    use NormalizesPhones;

    protected function prepareForValidation(): void
    {
        $this->normalizePhones(['phone']);
        // Champs facultatifs laissés vides : null (et non « »), sinon l'unicité de l'e-mail bloquerait le 2e compte sans e-mail
        $email = mb_strtolower(trim((string) $this->input('email')));
        $lastName = trim((string) $this->input('last_name'));
        $this->merge(['email' => $email === '' ? null : $email, 'last_name' => $lastName === '' ? null : $lastName]);
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'min:2', 'max:100'],
            // Inscription rapide (18 novembre 2026) : prénom, téléphone, mot de passe. Nom et e-mail facultatifs.
            'last_name' => ['nullable', 'string', 'min:2', 'max:100'],
            'email' => ['nullable', 'email:rfc', 'max:191', 'unique:users,email'],
            // Unique parmi les comptes ET parmi les fiches clientes déjà reliées à un compte : une cliente qui a
            // changé de numéro garde l'ancien sur sa fiche ; sans cette règle, l'inscription plantait (erreur 500)
            'phone' => ['required', 'string', 'regex:'.Phone::SENEGAL_MOBILE, 'unique:users,phone', Rule::unique('customers', 'phone')->whereNotNull('user_id')],
            // 8 caractères minimum, 72 maximum (limite de bcrypt). Plus de 2e saisie : le bouton « Afficher » la remplace
            'password' => ['required', 'max:72', Password::defaults()], // règle commune : AppServiceProvider
            'consent' => ['accepted'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Un compte existe déjà avec cette adresse.',
            'phone.unique' => 'Ce numéro est déjà utilisé.',
            'phone.regex' => 'Numéro mobile invalide.',
        ];
    }
}
