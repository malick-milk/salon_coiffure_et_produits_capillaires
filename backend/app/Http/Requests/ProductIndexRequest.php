<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Filtres du catalogue : on valide même une simple lecture (pas de paramètre inattendu dans les requêtes SQL) */
class ProductIndexRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'category' => ['nullable', 'string', 'max:140', 'alpha_dash'],
            'search' => ['nullable', 'string', 'max:100'],
            'min_price' => ['nullable', 'integer', 'min:0'],
            'max_price' => ['nullable', 'integer', 'min:0'],
            'in_stock' => ['nullable', 'boolean'],
            'featured' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'in:newest,price_asc,price_desc,name'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
