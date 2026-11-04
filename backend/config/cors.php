<?php

/*
| CORS : quels SITES ont le droit d'appeler l'API depuis un navigateur (OWASP A05).
| Par défaut, Laravel accepte toutes les origines (« * »). Ici, seule la vitrine du salon est autorisée :
| un site pirate ne peut pas lire les réponses de l'API, même si la victime y est connectée.
| En production, la vitrine et l'API sont sur le même domaine : CORS n'intervient même pas.
*/
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    'allowed_origins' => array_values(array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', env('FRONTEND_URL', 'http://localhost:5173')))))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Accept', 'Content-Type', 'X-Requested-With', 'X-XSRF-TOKEN'],
    'exposed_headers' => [],
    'max_age' => 3600,
    'supports_credentials' => true, // cookie de session Sanctum
];
