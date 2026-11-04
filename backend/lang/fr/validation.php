<?php

/*
| Messages de validation en français (APP_LOCALE=fr).
| :attribute est remplacé par le nom lisible défini dans « attributes » en bas de fichier.
*/
return [
    'accepted' => 'Vous devez accepter :attribute.',
    'alpha_dash' => ':Attribute ne peut contenir que des lettres, chiffres et tirets.',
    'array' => ':Attribute doit être une liste.',
    'boolean' => ':Attribute doit être vrai ou faux.',
    'confirmed' => 'La confirmation de :attribute ne correspond pas.',
    'date' => ':Attribute n’est pas une date valide.',
    'date_format' => ':Attribute doit respecter le format :format.',
    'after' => ':Attribute doit être postérieur à :date.',
    'after_or_equal' => ':Attribute doit être postérieur ou égal à :date.',
    'before' => ':Attribute doit être antérieur à :date.',
    'before_or_equal' => ':Attribute doit être antérieur ou égal à :date.',
    'between' => [
        'numeric' => ':Attribute doit être compris entre :min et :max.',
        'string' => ':Attribute doit contenir entre :min et :max caractères.',
    ],
    'distinct' => ':Attribute contient une valeur en double.',
    'email' => ':Attribute doit être une adresse email valide.',
    'exists' => ':Attribute est invalide ou n’existe plus.',
    'gt' => [
        'numeric' => ':Attribute doit être supérieur à :value.',
        'string' => ':Attribute doit contenir plus de :value caractères.',
    ],
    'gte' => ['numeric' => ':Attribute doit être supérieur ou égal à :value.'],
    'lt' => ['numeric' => ':Attribute doit être inférieur à :value.'],
    'lte' => ['numeric' => ':Attribute doit être inférieur ou égal à :value.'],
    'in' => ':Attribute est invalide.',
    'not_in' => ':Attribute n’est pas une valeur acceptée.',
    'integer' => ':Attribute doit être un nombre entier.',
    'max' => [
        'numeric' => ':Attribute ne peut pas dépasser :max.',
        'string' => ':Attribute ne peut pas dépasser :max caractères.',
        'array' => ':Attribute ne peut pas contenir plus de :max éléments.',
    ],
    'min' => [
        'numeric' => ':Attribute doit être au moins :min.',
        'string' => ':Attribute doit contenir au moins :min caractères.',
        'array' => ':Attribute doit contenir au moins :min élément(s).',
    ],
    'numeric' => ':Attribute doit être un nombre.',
    'regex' => 'Le format de :attribute est invalide.',
    'required' => ':Attribute est obligatoire.',
    'required_if' => ':Attribute est obligatoire quand :other vaut :value.',
    'string' => ':Attribute doit être un texte.',
    'unique' => ':Attribute est déjà utilisé.',
    'password' => [
        'letters' => ':Attribute doit contenir au moins une lettre.',
        'numbers' => ':Attribute doit contenir au moins un chiffre.',
        'uncompromised' => 'Ce :attribute apparaît dans une fuite de données connue. Choisissez-en un autre.',
    ],

    'attributes' => [
        'category' => 'la catégorie', 'search' => 'la recherche', 'min_price' => 'le prix minimum', 'max_price' => 'le prix maximum',
        'in_stock' => 'le filtre « en stock »', 'featured' => 'le filtre « produits phares »', 'sort' => 'le tri', 'page' => 'la page',
        'service_id' => 'la prestation', 'stylist_id' => 'le coiffeur', 'date' => 'la date', 'time' => 'l’heure',
        'first_name' => 'le prénom', 'last_name' => 'le nom', 'email' => 'l’email', 'phone' => 'le téléphone',
        'password' => 'le mot de passe', 'consent' => 'le consentement', 'notes' => 'la remarque',
        'customer.first_name' => 'le prénom', 'customer.last_name' => 'le nom', 'customer.phone' => 'le téléphone', 'customer.email' => 'l’email',
        'items' => 'les articles', 'items.*.product_id' => 'le produit', 'items.*.quantity' => 'la quantité',
        'fulfillment_method' => 'le mode de réception', 'delivery_zone_id' => 'la zone de livraison',
        'shipping_address.city' => 'la ville', 'shipping_address.address_line' => 'l’adresse',
        'dataset' => 'le jeu de données', 'compare_at_price' => 'le prix barré', 'price' => 'le prix', 'quantity' => 'la quantité',
        'reason' => 'le motif', 'low_stock_threshold' => 'le seuil d’alerte',
        // ERP : fabrication, stock, encaissement, équipe, filtres
        'product_id' => 'le produit', 'batch_number' => 'le numéro de lot', 'quantity_produced' => 'la quantité fabriquée',
        'produced_on' => 'la date de fabrication', 'expires_on' => 'la date de péremption', 'costs' => 'les coûts du lot',
        'costs.*.amount' => 'le montant', 'costs.*.category' => 'le poste de coût', 'costs.*.label' => 'la description du coût',
        'description' => 'la description', 'short_description' => 'la description courte', 'is_active' => 'l’activation', 'is_featured' => 'la mise en avant',
        'method' => 'le moyen de paiement', 'provider_reference' => 'la référence de transaction', 'payment_status' => 'le statut du paiement',
        'status' => 'le statut', 'type' => 'le type d’opération', 'role' => 'le rôle', 'log' => 'le domaine',
        'shipping_address' => 'l’adresse de livraison', 'shipping_address.district' => 'le quartier', 'shipping_address.landmark' => 'le point de repère', 'from' => 'la date de début', 'to' => 'la date de fin',
    ],
];
