<?php

namespace App\Http\Requests;

use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    use NormalizesPhones;

    protected function prepareForValidation(): void
    {
        $this->normalizePhones(['phone']);
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'min:2', 'max:100'],
            'last_name' => ['required', 'string', 'min:2', 'max:100'],
            // Unique, SAUF pour l'utilisateur lui-même (il peut garder son numéro)
            'phone' => ['required', 'string', 'regex:'.Phone::SENEGAL_MOBILE, Rule::unique('users', 'phone')->ignore($this->user()->id)],
        ];
    }

    public function messages(): array
    {
        return ['phone.regex' => 'Numéro mobile invalide.', 'phone.unique' => 'Ce numéro est déjà utilisé.'];
    }
}
