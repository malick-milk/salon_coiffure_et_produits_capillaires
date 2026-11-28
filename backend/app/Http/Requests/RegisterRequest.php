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
            // 10 caractères minimum (majuscule, minuscule, chiffre : AppServiceProvider), 72 maximum (limite de bcrypt),
            // saisi DEUX fois (confirmation), et ni le numéro ni le prénom dedans (premier essai d'un pirate)
            'password' => ['required', 'confirmed', 'max:72', Password::defaults(), function (string $attribute, mixed $value, \Closure $fail): void {
                $password = mb_strtolower((string) $value);
                $digits = preg_replace('/\D/', '', (string) $this->input('phone'));
                $firstName = mb_strtolower(trim((string) $this->input('first_name')));
                if (strlen($digits) >= 7 && str_contains(preg_replace('/\D/', '', $password) ?? '', substr($digits, -7))) {
                    $fail('Le mot de passe ne doit pas contenir votre numéro de téléphone.');
                } elseif (mb_strlen($firstName) >= 3 && str_contains($password, $firstName)) {
                    $fail('Le mot de passe ne doit pas contenir votre prénom.');
                }
            }],
            'consent' => ['accepted'],
            // Offres par e-mail : case distincte, non cochée, FACULTATIVE (refuser n'empêche rien)
            'marketing_consent' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Un compte existe déjà avec cette adresse.',
            'phone.unique' => 'Ce numéro est déjà utilisé.',
            'phone.regex' => 'Numéro mobile invalide.',
            'password.confirmed' => 'Les mots de passe ne correspondent pas.',
        ];
    }
}
