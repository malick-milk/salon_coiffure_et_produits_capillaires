<?php

namespace App\Http\Requests;

use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    use NormalizesPhones;

    public function rules(): array
    {
        $user = $this->user();
        $customerId = $user->customer?->id;

        return [
            'first_name' => ['required', 'string', 'min:2', 'max:100'],
            'last_name' => ['nullable', 'string', 'min:2', 'max:100'], // facultatif depuis l'inscription rapide
            // Unique parmi les comptes (sauf le sien) ET parmi les fiches clientes (sauf la sienne) :
            // la fiche suit le compte, deux fiches ne peuvent pas porter le même numéro
            'phone' => ['required', 'string', 'regex:'.Phone::SENEGAL_MOBILE, Rule::unique('users', 'phone')->ignore($user->id),
                Rule::unique('customers', 'phone')->ignore($customerId)],
            // AJOUTER un e-mail quand le compte n'en a pas (inscription rapide). Le CHANGER passe toujours par
            // le salon (vérification d'identité) : s'il y en a déjà un, le champ est ignoré (exclude), comme
            // tout champ inattendu (test de sécurité 3b : on ne modifie pas le compte d'un autre).
            'email' => $user->email === null ? ['nullable', 'email:rfc', 'max:191', 'unique:users,email'] : ['exclude'],
        ];
    }

    protected function prepareForValidation(): void
    {
        foreach (['last_name', 'email'] as $key) {
            if ($this->has($key) && trim((string) $this->input($key)) === '') {
                $this->merge([$key => null]); // champ vidé : null, pas « »
            }
        }
        if ($this->filled('email')) {
            $this->merge(['email' => mb_strtolower(trim((string) $this->input('email')))]);
        }
        $this->normalizePhones(['phone']);
    }

    public function messages(): array
    {
        return ['phone.regex' => 'Numéro mobile invalide.', 'phone.unique' => 'Ce numéro est déjà utilisé.',
            'email.unique' => 'Un compte existe déjà avec cette adresse.'];
    }
}
