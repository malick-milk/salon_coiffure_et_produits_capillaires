<?php

namespace App\Http\Requests;

use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Une commande ne contient AUCUN prix : seulement des identifiants et des quantités (RG-COM-04) */
class StoreOrderRequest extends FormRequest
{
    use NormalizesPhones;

    protected function prepareForValidation(): void
    {
        $this->normalizePhones(['customer.phone']);
    }

    public function rules(): array
    {
        $delivery = 'required_if:fulfillment_method,delivery';

        return [
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'integer', 'distinct'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'fulfillment_method' => ['required', 'in:pickup,delivery,pickup_point'],
            'pickup_point_id' => ['required_if:fulfillment_method,pickup_point', 'nullable', 'integer', Rule::exists('pickup_points', 'id')->where('is_active', true)],
            'delivery_zone_id' => ['nullable', $delivery, 'integer', 'exists:delivery_zones,id'],
            'customer.first_name' => ['required', 'string', 'min:2', 'max:100'],
            'customer.last_name' => ['required', 'string', 'min:2', 'max:100'],
            'customer.phone' => ['required', 'string', 'regex:'.Phone::SENEGAL_MOBILE],
            'customer.email' => ['nullable', 'email:rfc', 'max:191'],
            'shipping_address' => ['nullable', $delivery, 'array'],
            'shipping_address.city' => ['nullable', $delivery, 'string', 'min:2', 'max:100'],
            'shipping_address.district' => ['nullable', 'string', 'max:100'],
            'shipping_address.address_line' => ['nullable', $delivery, 'string', 'min:3', 'max:255'],
            'shipping_address.landmark' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:500'],
            'consent' => ['accepted'],
        ];
    }

    public function messages(): array
    {
        return [
            'customer.phone.regex' => 'Numéro mobile invalide (exemple : 77 123 45 67).',
            'shipping_address.address_line.required_if' => 'L’adresse est obligatoire pour une livraison.',
            'delivery_zone_id.required_if' => 'Choisissez votre zone de livraison.',
        ];
    }
}
