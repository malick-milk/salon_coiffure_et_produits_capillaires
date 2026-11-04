<?php

namespace App\Http\Requests;

use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    use NormalizesPhones;

    protected function prepareForValidation(): void
    {
        $this->normalizePhones(['phone']);
        $this->merge(['email' => mb_strtolower(trim((string) $this->input('email')))]);
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'min:2', 'max:100'],
            'last_name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['required', 'email:rfc', 'max:191', 'unique:users,email'],
            'phone' => ['required', 'string', 'regex:'.Phone::SENEGAL_MOBILE, 'unique:users,phone'],
            // 8 caractères minimum, 72 maximum (limite de bcrypt), confirmation identique
            'password' => ['required', 'confirmed', 'max:72', Password::defaults()], // règle commune : AppServiceProvider
            'consent' => ['accepted'],
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
