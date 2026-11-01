<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AvailabilityRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'service_id' => ['required', 'integer', 'exists:services,id'],
            'stylist_id' => ['nullable', 'integer', 'exists:stylists,id'],
            'date' => ['required', 'date_format:Y-m-d'],
        ];
    }
}
