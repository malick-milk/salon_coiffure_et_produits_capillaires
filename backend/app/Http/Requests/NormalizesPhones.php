<?php

namespace App\Http\Requests;

use App\Support\Phone;

/** Outils partagés : normaliser les téléphones AVANT la validation (« 77 123 45 67 » -> « 771234567 ») */
trait NormalizesPhones
{
    /** @param list<string> $keys clés en notation pointée : 'phone', 'customer.phone' */
    protected function normalizePhones(array $keys): void
    {
        $data = $this->all();
        foreach ($keys as $key) {
            if (data_get($data, $key) !== null) {
                data_set($data, $key, Phone::normalize(data_get($data, $key)));
            }
        }
        $this->replace($data);
    }
}
