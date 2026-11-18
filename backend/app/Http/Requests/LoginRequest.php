<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            // E-mail OU téléphone : un compte créé sans e-mail se connecte avec son numéro
            'email' => ['required', 'string', 'max:191'],
            'password' => ['required', 'string'],
            'remember' => ['boolean'],
        ];
    }
}
