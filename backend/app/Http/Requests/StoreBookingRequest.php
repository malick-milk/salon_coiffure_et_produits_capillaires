<?php

namespace App\Http\Requests;

use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;

/** Validation SERVEUR d'une réservation : elle refait tous les contrôles du frontend, et plus encore */
class StoreBookingRequest extends FormRequest
{
    use NormalizesPhones;

    protected function prepareForValidation(): void
    {
        $this->normalizePhones(['customer.phone']);
    }

    public function rules(): array
    {
        return [
            'service_id' => ['required', 'integer', 'exists:services,id'],
            'stylist_id' => ['nullable', 'integer', 'exists:stylists,id'],
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'time' => ['required', 'date_format:H:i'],
            'customer.first_name' => ['required', 'string', 'min:2', 'max:100'],
            'customer.last_name' => ['required', 'string', 'min:2', 'max:100'],
            'customer.phone' => ['required', 'string', 'regex:'.Phone::SENEGAL_MOBILE],
            'customer.email' => ['nullable', 'email:rfc', 'max:191'],
            'notes' => ['nullable', 'string', 'max:500'],
            'consent' => ['accepted'],
        ];
    }

    public function messages(): array
    {
        return ['customer.phone.regex' => 'Numéro mobile invalide (exemple : 77 123 45 67).'];
    }
}
