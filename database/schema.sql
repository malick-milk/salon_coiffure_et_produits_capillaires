-- =====================================================================
--  SALON PLATFORM — Schéma physique de référence (MySQL 8.x)
-- =====================================================================
--  Rôle de ce fichier :
--    - Référence lisible du modèle de données, conçue à l'étape 3.
--    - À l'étape 6, chaque table sera traduite en MIGRATION Laravel
--      (database/migrations/*.php). Les migrations deviendront alors la
--      source de vérité ; ce fichier restera une documentation.
--
--  Conventions :
--    - Moteur InnoDB (transactions + clés étrangères), utf8mb4 (accents, tous caractères).
--    - Noms en anglais, snake_case, tables au pluriel (convention Laravel).
--    - Clés primaires : BIGINT UNSIGNED AUTO_INCREMENT nommées `id`.
--    - Montants : INT UNSIGNED en XOF (le FCFA n'a pas de centimes). Jamais de FLOAT.
--    - Dates : stockées en UTC. Africa/Dakar = UTC+0 toute l'année.
--    - created_at / updated_at : gérés automatiquement par Laravel.
--    - deleted_at : suppression logique (soft delete) des données métier.
--    - Les tables techniques de Laravel (sessions, jobs, cache,
--      password_reset_tokens, personal_access_tokens) seront créées par le
--      framework et ne figurent pas ici.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
--  DOMAINE 1 — UTILISATEURS, RÔLES, PERMISSIONS (RBAC)
-- =====================================================================

-- Comptes qui peuvent SE CONNECTER (clients inscrits + personnel).
CREATE TABLE users (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    first_name        VARCHAR(100) NOT NULL,
    last_name         VARCHAR(100) NOT NULL,
    email             VARCHAR(191) NOT NULL,
    phone             VARCHAR(20)  NULL,                 -- format E.164 : +221771234567
    password          VARCHAR(255) NOT NULL,             -- HASH bcrypt/argon2, jamais le mot de passe en clair
    email_verified_at TIMESTAMP NULL,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,     -- désactiver un employé sans supprimer son historique
    last_login_at     TIMESTAMP NULL,
    remember_token    VARCHAR(100) NULL,
    created_at        TIMESTAMP NULL,
    updated_at        TIMESTAMP NULL,
    deleted_at        TIMESTAMP NULL,
    UNIQUE KEY users_email_unique (email),
    UNIQUE KEY users_phone_unique (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tables du paquet spatie/laravel-permission (structure standard du paquet).
CREATE TABLE permissions (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(125) NOT NULL,          -- ex. 'products.update', 'analytics.view'
    guard_name VARCHAR(125) NOT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY permissions_name_guard_unique (name, guard_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(125) NOT NULL,          -- ex. 'super_admin', 'manager', 'cashier', 'stylist', 'customer'
    guard_name VARCHAR(125) NOT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY roles_name_guard_unique (name, guard_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_has_permissions (
    permission_id BIGINT UNSIGNED NOT NULL,
    role_id       BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (permission_id, role_id),
    CONSTRAINT rhp_permission_fk FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE,
    CONSTRAINT rhp_role_fk       FOREIGN KEY (role_id)       REFERENCES roles (id)       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relations polymorphes : model_type = 'App\\Models\\User', model_id = users.id
CREATE TABLE model_has_roles (
    role_id    BIGINT UNSIGNED NOT NULL,
    model_type VARCHAR(191) NOT NULL,
    model_id   BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, model_id, model_type),
    KEY model_has_roles_model_index (model_id, model_type),
    CONSTRAINT mhr_role_fk FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE model_has_permissions (
    permission_id BIGINT UNSIGNED NOT NULL,
    model_type    VARCHAR(191) NOT NULL,
    model_id      BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (permission_id, model_id, model_type),
    KEY model_has_permissions_model_index (model_id, model_type),
    CONSTRAINT mhp_permission_fk FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Journal d'audit (structure du paquet spatie/laravel-activitylog).
CREATE TABLE activity_log (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    log_name     VARCHAR(191) NULL,
    description  TEXT NOT NULL,                       -- ex. 'updated'
    subject_type VARCHAR(191) NULL,                   -- objet modifié : 'App\\Models\\Product'
    subject_id   BIGINT UNSIGNED NULL,
    event        VARCHAR(191) NULL,                   -- created / updated / deleted
    causer_type  VARCHAR(191) NULL,                   -- auteur : 'App\\Models\\User'
    causer_id    BIGINT UNSIGNED NULL,
    properties   JSON NULL,                           -- {"old": {"price": 5000}, "attributes": {"price": 6500}, "ip": "..."}
    batch_uuid   CHAR(36) NULL,
    created_at   TIMESTAMP NULL,
    updated_at   TIMESTAMP NULL,
    KEY activity_log_log_name_index (log_name),
    KEY activity_log_subject_index (subject_type, subject_id),
    KEY activity_log_causer_index (causer_type, causer_id),
    KEY activity_log_created_at_index (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
--  DOMAINE 2 — CLIENTS
-- =====================================================================

-- Le CLIENT au sens métier : celui qui achète ou réserve, inscrit OU invité.
-- Séparé de `users` (qui sert à l'authentification) : voir DATABASE.md §3.1.
CREATE TABLE customers (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id           BIGINT UNSIGNED NULL,           -- NULL = client invité (sans compte)
    first_name        VARCHAR(100) NOT NULL,
    last_name         VARCHAR(100) NOT NULL,
    customer_type     ENUM('individual','reseller') NOT NULL DEFAULT 'individual', -- particulier / revendeur (vente en gros)
    phone             VARCHAR(20)  NOT NULL,          -- identifiant naturel d'un invité
    email             VARCHAR(191) NULL,
    marketing_consent BOOLEAN NOT NULL DEFAULT FALSE, -- consentement explicite (données personnelles)
    notes             TEXT NULL,                      -- notes internes (allergies, préférences)
    created_at        TIMESTAMP NULL,
    updated_at        TIMESTAMP NULL,
    deleted_at        TIMESTAMP NULL,
    UNIQUE KEY customers_user_id_unique (user_id),   -- un compte = au plus une fiche client
    UNIQUE KEY customers_phone_unique (phone),       -- évite les doublons d'invités
    KEY customers_email_index (email),
    KEY customers_created_at_index (created_at),
    CONSTRAINT customers_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_zones (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,                -- ex. 'Dakar Plateau', 'Pikine', 'Rufisque'
    fee        INT UNSIGNED NOT NULL DEFAULT 0,      -- frais de livraison en XOF
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY delivery_zones_name_unique (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE addresses (
    id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id      BIGINT UNSIGNED NOT NULL,
    delivery_zone_id BIGINT UNSIGNED NULL,
    label            VARCHAR(50)  NULL,              -- 'Maison', 'Bureau'
    recipient_name   VARCHAR(150) NOT NULL,
    phone            VARCHAR(20)  NOT NULL,
    city             VARCHAR(100) NOT NULL,
    district         VARCHAR(100) NULL,              -- quartier
    address_line     VARCHAR(255) NOT NULL,
    landmark         VARCHAR(255) NULL,              -- point de repère (très utile pour les livreurs)
    is_default       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMP NULL,
    updated_at       TIMESTAMP NULL,
    KEY addresses_customer_index (customer_id),
    CONSTRAINT addresses_customer_fk FOREIGN KEY (customer_id)      REFERENCES customers (id)      ON DELETE CASCADE,
    CONSTRAINT addresses_zone_fk     FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
--  DOMAINE 3 — CATALOGUE ET STOCK
-- =====================================================================

CREATE TABLE categories (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    parent_id   BIGINT UNSIGNED NULL,                -- auto-référence : sous-catégories
    name        VARCHAR(120) NOT NULL,
    slug        VARCHAR(140) NOT NULL,               -- partie lisible de l'URL : 'huiles-capillaires'
    description TEXT NULL,
    image_path  VARCHAR(255) NULL,
    position    SMALLINT UNSIGNED NOT NULL DEFAULT 0, -- ordre d'affichage
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP NULL,
    updated_at  TIMESTAMP NULL,
    deleted_at  TIMESTAMP NULL,
    UNIQUE KEY categories_slug_unique (slug),
    KEY categories_parent_index (parent_id),
    CONSTRAINT categories_parent_fk FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE brands (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(120) NOT NULL,
    slug       VARCHAR(140) NOT NULL,
    logo_path  VARCHAR(255) NULL,
    is_house_brand BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = marque fabriquée par l'entreprise (Dabo Hair)
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY brands_slug_unique (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Types de cheveux (filtre catalogue) : crépus, frisés, bouclés, lisses, colorés…
CREATE TABLE hair_types (
    id   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    UNIQUE KEY hair_types_slug_unique (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id         BIGINT UNSIGNED NOT NULL,
    brand_id            BIGINT UNSIGNED NULL,
    variant_of_id       BIGINT UNSIGNED NULL,           -- autre contenance du même produit (ex. sérum 15 ml -> sérum 30 ml)
    sku                 VARCHAR(64)  NOT NULL,          -- référence interne unique (Stock Keeping Unit)
    name                VARCHAR(191) NOT NULL,
    slug                VARCHAR(191) NOT NULL,
    short_description   VARCHAR(500) NULL,
    description         TEXT NULL,
    unit_size           VARCHAR(50)  NULL,              -- '250 ml', '500 g'
    price               INT UNSIGNED NOT NULL,          -- prix de vente TTC en XOF
    compare_at_price    INT UNSIGNED NULL,              -- ancien prix barré (promotion)
    cost_price          INT UNSIGNED NULL,              -- coût d'achat OU coût de revient (fabrication). NULL = pas encore calculé.
                                                        -- JAMAIS exposé au public (RG-STK-06)
    stock_quantity      INT UNSIGNED NOT NULL DEFAULT 0,-- CACHE de la somme des mouvements (ADR-006)
    low_stock_threshold INT UNSIGNED NOT NULL DEFAULT 5,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,  -- visible dans le catalogue
    is_featured         BOOLEAN NOT NULL DEFAULT FALSE, -- « produit phare » sur l'accueil
    meta_title          VARCHAR(191) NULL,              -- SEO
    meta_description    VARCHAR(320) NULL,              -- SEO
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,
    deleted_at          TIMESTAMP NULL,
    UNIQUE KEY products_sku_unique (sku),
    UNIQUE KEY products_slug_unique (slug),
    KEY products_catalog_index (is_active, category_id, price),   -- filtre catalogue
    KEY products_featured_index (is_featured, is_active),
    KEY products_brand_index (brand_id),
    KEY products_variant_index (variant_of_id),
    FULLTEXT KEY products_search_fulltext (name, short_description), -- recherche par mot-clé
    CONSTRAINT products_category_fk FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
    CONSTRAINT products_brand_fk    FOREIGN KEY (brand_id)    REFERENCES brands (id)     ON DELETE SET NULL,
    CONSTRAINT products_variant_fk  FOREIGN KEY (variant_of_id) REFERENCES products (id) ON DELETE SET NULL,
    CONSTRAINT products_compare_price_chk CHECK (compare_at_price IS NULL OR compare_at_price > price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_hair_type (
    product_id   BIGINT UNSIGNED NOT NULL,
    hair_type_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (product_id, hair_type_id),
    KEY pht_hair_type_index (hair_type_id),
    CONSTRAINT pht_product_fk   FOREIGN KEY (product_id)   REFERENCES products (id)   ON DELETE CASCADE,
    CONSTRAINT pht_hair_type_fk FOREIGN KEY (hair_type_id) REFERENCES hair_types (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_images (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    path       VARCHAR(255) NOT NULL,
    alt_text   VARCHAR(191) NULL,                     -- accessibilité + SEO
    position   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    KEY product_images_product_index (product_id, position),
    CONSTRAINT product_images_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- GRAND LIVRE DU STOCK (ADR-006) : une ligne par variation, jamais modifiée ni supprimée.
-- stock actuel = SUM(quantity) ; products.stock_quantity n'en est qu'un cache.
CREATE TABLE stock_movements (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id     BIGINT UNSIGNED NOT NULL,
    type           ENUM('initial','production','purchase','sale','sale_cancellation','customer_return','loss','adjustment') NOT NULL,
    quantity       INT NOT NULL,                     -- SIGNÉ : +10 entrée, -2 sortie
    stock_after    INT UNSIGNED NOT NULL,            -- stock après le mouvement (contrôle de cohérence)
    unit_cost      INT UNSIGNED NULL,                -- coût unitaire (entrées) : valorisation du stock
    reference_type VARCHAR(191) NULL,                -- origine polymorphe : 'App\\Models\\Order'
    reference_id   BIGINT UNSIGNED NULL,
    reason         VARCHAR(255) NULL,                -- obligatoire côté application pour loss / adjustment
    user_id        BIGINT UNSIGNED NULL,             -- auteur (NULL = automatique, ex. commande en ligne)
    created_at     TIMESTAMP NULL,
    KEY stock_movements_product_date_index (product_id, created_at),
    KEY stock_movements_type_date_index (type, created_at),
    KEY stock_movements_reference_index (reference_type, reference_id),
    CONSTRAINT stock_movements_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
    CONSTRAINT stock_movements_user_fk    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE SET NULL,
    CONSTRAINT stock_movements_quantity_chk CHECK (quantity <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- LOTS DE FABRICATION : l'entreprise fabrique ses produits (marque Dabo Hair).
-- Chaque lot produit fait entrer du stock (mouvement 'production') et garde la
-- traçabilité exigée pour des cosmétiques : numéro de lot et date de péremption.
CREATE TABLE production_batches (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_number      VARCHAR(40) NOT NULL,           -- numéro de lot imprimé sur le flacon : 'LOT-2026-03-SHA'
    product_id        BIGINT UNSIGNED NOT NULL,
    quantity_produced INT UNSIGNED NOT NULL,          -- unités fabriquées
    unit_cost         INT UNSIGNED NULL,              -- coût de revient unitaire du lot (matières + flacon + étiquette)
    produced_on       DATE NOT NULL,
    expires_on        DATE NULL,                      -- date de péremption
    notes             TEXT NULL,
    created_by        BIGINT UNSIGNED NULL,
    created_at        TIMESTAMP NULL,
    updated_at        TIMESTAMP NULL,
    UNIQUE KEY production_batches_number_unique (batch_number),
    KEY production_batches_product_index (product_id, produced_on),
    KEY production_batches_expiry_index (expires_on),            -- lots proches de la péremption
    CONSTRAINT production_batches_product_fk    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
    CONSTRAINT production_batches_created_by_fk FOREIGN KEY (created_by) REFERENCES users (id)    ON DELETE SET NULL,
    CONSTRAINT production_batches_quantity_chk  CHECK (quantity_produced > 0),
    CONSTRAINT production_batches_expiry_chk    CHECK (expires_on IS NULL OR expires_on > produced_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FOURNISSEURS : pour les produits d'autres marques revendus en boutique (si l'entreprise en revend).
CREATE TABLE suppliers (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(150) NOT NULL,
    contact_name VARCHAR(150) NULL,
    phone        VARCHAR(20)  NULL,
    email        VARCHAR(191) NULL,
    address      VARCHAR(255) NULL,
    notes        TEXT NULL,                          -- délais, conditions de paiement…
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP NULL,
    updated_at   TIMESTAMP NULL,
    deleted_at   TIMESTAMP NULL,
    UNIQUE KEY suppliers_name_unique (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- BONS DE COMMANDE FOURNISSEUR : achat de produits revendus, souvent par lots (douzaines).
CREATE TABLE purchase_orders (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference   VARCHAR(30) NOT NULL,                 -- 'BC-2026-0001'
    supplier_id BIGINT UNSIGNED NOT NULL,
    status      ENUM('draft','ordered','partially_received','received','cancelled') NOT NULL DEFAULT 'draft',
    total_cost  BIGINT UNSIGNED NOT NULL DEFAULT 0,   -- somme des lignes (recalculée par l'application)
    ordered_at  DATETIME NULL,
    expected_at DATE NULL,                            -- livraison prévue
    received_at DATETIME NULL,
    notes       TEXT NULL,
    created_by  BIGINT UNSIGNED NULL,
    created_at  TIMESTAMP NULL,
    updated_at  TIMESTAMP NULL,
    UNIQUE KEY purchase_orders_reference_unique (reference),
    KEY purchase_orders_supplier_index (supplier_id, ordered_at),
    KEY purchase_orders_status_index (status),
    CONSTRAINT purchase_orders_supplier_fk   FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
    CONSTRAINT purchase_orders_created_by_fk FOREIGN KEY (created_by)  REFERENCES users (id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_order_items (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id BIGINT UNSIGNED NOT NULL,
    product_id        BIGINT UNSIGNED NOT NULL,
    packs_ordered     INT UNSIGNED NOT NULL,          -- nombre de lots commandés (ex. 4 douzaines)
    units_per_pack    INT UNSIGNED NOT NULL DEFAULT 12, -- unités par lot (12 = douzaine)
    unit_cost         INT UNSIGNED NOT NULL,          -- coût d'UNE unité en XOF
    -- Colonnes GÉNÉRÉES : calculées par MySQL, impossibles à saisir de travers
    quantity_ordered  INT UNSIGNED AS (packs_ordered * units_per_pack) STORED,             -- 4 x 12 = 48
    line_total        BIGINT UNSIGNED AS (packs_ordered * units_per_pack * unit_cost) STORED, -- 48 x 3 000 = 144 000
    quantity_received INT UNSIGNED NOT NULL DEFAULT 0, -- unités réellement reçues (réception partielle possible)
    created_at        TIMESTAMP NULL,
    updated_at        TIMESTAMP NULL,
    UNIQUE KEY poi_order_product_unique (purchase_order_id, product_id),
    KEY poi_product_index (product_id),
    CONSTRAINT poi_order_fk   FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE,
    CONSTRAINT poi_product_fk FOREIGN KEY (product_id)        REFERENCES products (id)        ON DELETE RESTRICT,
    CONSTRAINT poi_packs_chk    CHECK (packs_ordered > 0 AND units_per_pack > 0),
    CONSTRAINT poi_received_chk CHECK (quantity_received <= packs_ordered * units_per_pack)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AVIS CLIENTS (entité « Avis » du MCD existant, enrichie : modération + achat vérifié)
CREATE TABLE product_reviews (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id  BIGINT UNSIGNED NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    order_id    BIGINT UNSIGNED NULL,                 -- renseigné = « achat vérifié »
    rating      TINYINT UNSIGNED NOT NULL,            -- note de 1 à 5
    comment     TEXT NULL,
    status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending', -- publié seulement après modération
    moderated_by BIGINT UNSIGNED NULL,
    moderated_at DATETIME NULL,
    created_at  TIMESTAMP NULL,
    updated_at  TIMESTAMP NULL,
    UNIQUE KEY reviews_product_customer_unique (product_id, customer_id), -- un avis par client et par produit
    KEY reviews_product_status_index (product_id, status),
    CONSTRAINT reviews_product_fk   FOREIGN KEY (product_id)   REFERENCES products (id)  ON DELETE CASCADE,
    CONSTRAINT reviews_customer_fk  FOREIGN KEY (customer_id)  REFERENCES customers (id) ON DELETE CASCADE,
    CONSTRAINT reviews_order_fk     FOREIGN KEY (order_id)     REFERENCES orders (id)    ON DELETE SET NULL,
    CONSTRAINT reviews_moderator_fk FOREIGN KEY (moderated_by) REFERENCES users (id)     ON DELETE SET NULL,
    CONSTRAINT reviews_rating_chk   CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FAVORIS (MCD existant) : en Merise, c'est une ASSOCIATION porteuse de la date, pas une entité.
-- D'où une clé primaire composée (user_id, product_id) au lieu d'un id_favoris.
CREATE TABLE favorites (
    user_id    BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NULL,
    PRIMARY KEY (user_id, product_id),                -- impossible d'ajouter deux fois le même favori
    KEY favorites_product_index (product_id),
    CONSTRAINT favorites_user_fk    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE CASCADE,
    CONSTRAINT favorites_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
--  DOMAINE 4 — COMMANDES, PAIEMENTS, FACTURES
-- =====================================================================

CREATE TABLE orders (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference           VARCHAR(30) NOT NULL,         -- 'CMD-2026-000123'
    customer_id         BIGINT UNSIGNED NOT NULL,
    created_by          BIGINT UNSIGNED NULL,         -- employé (vente en boutique) ; NULL = en ligne
    channel             ENUM('online','store') NOT NULL DEFAULT 'online',
    status              ENUM('pending','confirmed','preparing','ready','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
    payment_status      ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid',
    fulfillment_method  ENUM('pickup','delivery') NOT NULL,
    delivery_zone_id    BIGINT UNSIGNED NULL,
    -- Instantané de l'adresse (si le client modifie son adresse plus tard, la commande ne change pas)
    shipping_name       VARCHAR(150) NULL,
    shipping_phone      VARCHAR(20)  NULL,
    shipping_city       VARCHAR(100) NULL,
    shipping_district   VARCHAR(100) NULL,
    shipping_address    VARCHAR(255) NULL,
    shipping_landmark   VARCHAR(255) NULL,
    -- Montants en XOF, tous recalculés côté serveur (RG-COM-04)
    subtotal            INT UNSIGNED NOT NULL,        -- somme des lignes
    discount_total      INT UNSIGNED NOT NULL DEFAULT 0,
    shipping_fee        INT UNSIGNED NOT NULL DEFAULT 0,
    tax_rate            DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- taux appliqué à la date de commande (ex. 18.00)
    tax_total           INT UNSIGNED NOT NULL DEFAULT 0,    -- TVA incluse dans le total (prix TTC)
    total               INT UNSIGNED NOT NULL,        -- = subtotal - discount_total + shipping_fee
    customer_notes      VARCHAR(500) NULL,
    cancellation_reason VARCHAR(255) NULL,
    -- Horodatages métier : indispensables pour l'analyse des délais
    placed_at           DATETIME NOT NULL,
    confirmed_at        DATETIME NULL,
    shipped_at          DATETIME NULL,
    delivered_at        DATETIME NULL,
    paid_at             DATETIME NULL,
    cancelled_at        DATETIME NULL,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,
    UNIQUE KEY orders_reference_unique (reference),
    KEY orders_status_placed_index (status, placed_at),
    KEY orders_customer_placed_index (customer_id, placed_at),
    KEY orders_payment_paid_index (payment_status, paid_at),     -- calcul du CA
    CONSTRAINT orders_customer_fk   FOREIGN KEY (customer_id)      REFERENCES customers (id)      ON DELETE RESTRICT,
    CONSTRAINT orders_created_by_fk FOREIGN KEY (created_by)       REFERENCES users (id)          ON DELETE SET NULL,
    CONSTRAINT orders_zone_fk       FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones (id) ON DELETE SET NULL,
    CONSTRAINT orders_total_chk     CHECK (total = subtotal - discount_total + shipping_fee),
    CONSTRAINT orders_delivery_chk  CHECK (fulfillment_method = 'pickup' OR shipping_address IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id     BIGINT UNSIGNED NOT NULL,
    product_id   BIGINT UNSIGNED NOT NULL,
    -- INSTANTANÉS (RG-COM-03) : copiés au moment de l'achat, ne changent jamais ensuite
    product_name VARCHAR(191) NOT NULL,
    sku          VARCHAR(64)  NOT NULL,
    unit_price   INT UNSIGNED NOT NULL,              -- prix de vente unitaire au moment de l'achat
    unit_cost    INT UNSIGNED NULL,                  -- coût unitaire figé au moment de la vente (NULL si coût de revient inconnu)
    quantity     INT UNSIGNED NOT NULL,
    line_total   INT UNSIGNED NOT NULL,
    created_at   TIMESTAMP NULL,
    updated_at   TIMESTAMP NULL,
    KEY order_items_order_index (order_id),
    KEY order_items_product_index (product_id),
    CONSTRAINT order_items_order_fk   FOREIGN KEY (order_id)   REFERENCES orders (id)   ON DELETE CASCADE,
    CONSTRAINT order_items_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
    CONSTRAINT order_items_quantity_chk CHECK (quantity > 0),
    CONSTRAINT order_items_total_chk    CHECK (line_total = unit_price * quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PANIERS ENREGISTRÉS (MCD existant) : le panier suit le client d'un appareil à l'autre
-- et permet d'analyser les paniers abandonnés (données BI).
CREATE TABLE carts (
    id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id            BIGINT UNSIGNED NULL,          -- client connecté
    token              CHAR(36) NOT NULL,             -- UUID dans un cookie pour un invité
    status             ENUM('active','converted','abandoned') NOT NULL DEFAULT 'active',
    converted_order_id BIGINT UNSIGNED NULL,          -- commande issue de ce panier
    last_activity_at   DATETIME NOT NULL,
    created_at         TIMESTAMP NULL,
    updated_at         TIMESTAMP NULL,
    UNIQUE KEY carts_token_unique (token),
    KEY carts_user_status_index (user_id, status),
    KEY carts_status_activity_index (status, last_activity_at),   -- détection des paniers abandonnés
    CONSTRAINT carts_user_fk  FOREIGN KEY (user_id)            REFERENCES users (id)  ON DELETE CASCADE,
    CONSTRAINT carts_order_fk FOREIGN KEY (converted_order_id) REFERENCES orders (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Le prix n'est PAS stocké ici : un panier affiche toujours le prix ACTUEL.
-- Il est figé seulement dans order_items, au moment de la commande.
CREATE TABLE cart_items (
    cart_id    BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    quantity   INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    PRIMARY KEY (cart_id, product_id),                -- un produit = une ligne (on augmente la quantité)
    KEY cart_items_product_index (product_id),
    CONSTRAINT cart_items_cart_fk    FOREIGN KEY (cart_id)    REFERENCES carts (id)    ON DELETE CASCADE,
    CONSTRAINT cart_items_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
    CONSTRAINT cart_items_quantity_chk CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PAIEMENTS : séparés des commandes pour accueillir Wave / Orange Money / Free Money / carte (ADR-007).
-- Une commande peut avoir plusieurs tentatives de paiement ; une réservation peut aussi être payée.
CREATE TABLE payments (
    id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payable_type       VARCHAR(191) NOT NULL,         -- 'App\\Models\\Order' ou 'App\\Models\\Booking'
    payable_id         BIGINT UNSIGNED NOT NULL,
    gateway            VARCHAR(50) NOT NULL DEFAULT 'manual', -- clé de l'implémentation PaymentGateway
    method             ENUM('cash','wave','orange_money','free_money','card','bank_transfer') NOT NULL,
    amount             INT UNSIGNED NOT NULL,
    status             ENUM('pending','succeeded','failed','refunded') NOT NULL DEFAULT 'pending',
    provider_reference VARCHAR(191) NULL,             -- identifiant de transaction du fournisseur
    provider_payload   JSON NULL,                     -- réponse brute du fournisseur (audit, litiges)
    recorded_by        BIGINT UNSIGNED NULL,          -- employé qui a encaissé (paiement manuel)
    paid_at            DATETIME NULL,
    created_at         TIMESTAMP NULL,
    updated_at         TIMESTAMP NULL,
    UNIQUE KEY payments_gateway_reference_unique (gateway, provider_reference), -- idempotence des webhooks
    KEY payments_payable_index (payable_type, payable_id),
    KEY payments_status_paid_index (status, paid_at),
    CONSTRAINT payments_recorded_by_fk FOREIGN KEY (recorded_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT payments_amount_chk CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Compteur de numérotation des factures : garantit une suite SANS TROU (RG-FAC-02).
-- Usage : SELECT last_number FROM invoice_sequences WHERE year = 2026 FOR UPDATE; puis +1, dans une transaction.
CREATE TABLE invoice_sequences (
    year        SMALLINT UNSIGNED NOT NULL,
    type        ENUM('invoice','credit_note') NOT NULL,
    last_number INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (year, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FACTURES : immuables une fois émises (RG-FAC-03). Une correction = un avoir (credit_note).
CREATE TABLE invoices (
    id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    number             VARCHAR(30) NOT NULL,          -- 'FAC-2026-000001' / 'AV-2026-000001'
    type               ENUM('invoice','credit_note') NOT NULL DEFAULT 'invoice',
    order_id           BIGINT UNSIGNED NULL,
    booking_id         BIGINT UNSIGNED NULL,
    credited_invoice_id BIGINT UNSIGNED NULL,          -- facture annulée par cet avoir
    customer_id        BIGINT UNSIGNED NOT NULL,
    -- Instantanés : la facture doit rester identique même si le client ou l'entreprise change ses coordonnées
    customer_name      VARCHAR(200) NOT NULL,
    customer_phone     VARCHAR(20)  NULL,
    customer_email     VARCHAR(191) NULL,
    billing_address    VARCHAR(500) NULL,
    company_snapshot   JSON NOT NULL,                 -- raison sociale, NINEA, RCCM, adresse au jour de l'émission
    subtotal           INT UNSIGNED NOT NULL,
    tax_total          INT UNSIGNED NOT NULL DEFAULT 0,
    total              INT UNSIGNED NOT NULL,
    issued_at          DATETIME NOT NULL,
    pdf_path           VARCHAR(255) NULL,
    created_at         TIMESTAMP NULL,
    updated_at         TIMESTAMP NULL,
    UNIQUE KEY invoices_number_unique (number),
    KEY invoices_issued_index (issued_at),
    KEY invoices_customer_index (customer_id),
    KEY invoices_order_index (order_id),
    KEY invoices_booking_index (booking_id),
    CONSTRAINT invoices_order_fk    FOREIGN KEY (order_id)            REFERENCES orders (id)    ON DELETE RESTRICT,
    CONSTRAINT invoices_booking_fk  FOREIGN KEY (booking_id)          REFERENCES bookings (id)  ON DELETE RESTRICT,
    CONSTRAINT invoices_credited_fk FOREIGN KEY (credited_invoice_id) REFERENCES invoices (id)  ON DELETE RESTRICT,
    CONSTRAINT invoices_customer_fk FOREIGN KEY (customer_id)         REFERENCES customers (id) ON DELETE RESTRICT,
    -- Une facture porte sur une commande OU une réservation (exactement une des deux)
    CONSTRAINT invoices_source_chk CHECK ((order_id IS NULL) <> (booking_id IS NULL)),
    CONSTRAINT invoices_credit_chk CHECK (type = 'invoice' OR credited_invoice_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
--  DOMAINE 5 — SALON ET RÉSERVATIONS
-- =====================================================================

CREATE TABLE service_categories (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(120) NOT NULL,               -- 'Tresses', 'Soins', 'Coupes', 'Coloration'
    slug       VARCHAR(140) NOT NULL,
    position   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY service_categories_slug_unique (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE services (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_category_id BIGINT UNSIGNED NOT NULL,
    name                VARCHAR(150) NOT NULL,
    slug                VARCHAR(170) NOT NULL,
    description         TEXT NULL,
    duration_minutes    SMALLINT UNSIGNED NOT NULL,  -- durée de la prestation
    buffer_minutes      SMALLINT UNSIGNED NOT NULL DEFAULT 0, -- temps de nettoyage après la prestation
    price               INT UNSIGNED NOT NULL,       -- prix TTC en XOF (prix « à partir de » côté affichage si besoin)
    image_path          VARCHAR(255) NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    position            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,
    deleted_at          TIMESTAMP NULL,
    UNIQUE KEY services_slug_unique (slug),
    KEY services_category_index (service_category_id, is_active),
    CONSTRAINT services_category_fk FOREIGN KEY (service_category_id) REFERENCES service_categories (id) ON DELETE RESTRICT,
    CONSTRAINT services_duration_chk CHECK (duration_minutes > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Coiffeurs : profil public. Lié à un compte employé s'il se connecte à l'ERP.
CREATE TABLE stylists (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT UNSIGNED NULL,
    display_name VARCHAR(100) NOT NULL,
    bio          TEXT NULL,
    photo_path   VARCHAR(255) NULL,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP NULL,
    updated_at   TIMESTAMP NULL,
    deleted_at   TIMESTAMP NULL,
    UNIQUE KEY stylists_user_id_unique (user_id),
    CONSTRAINT stylists_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quelles prestations chaque coiffeur sait réaliser (relation N-N).
CREATE TABLE service_stylist (
    service_id BIGINT UNSIGNED NOT NULL,
    stylist_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (service_id, stylist_id),
    KEY service_stylist_stylist_index (stylist_id),
    CONSTRAINT ss_service_fk FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE,
    CONSTRAINT ss_stylist_fk FOREIGN KEY (stylist_id) REFERENCES stylists (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Horaires d'ouverture hebdomadaires du salon (1 = lundi … 7 = dimanche, norme ISO-8601).
CREATE TABLE business_hours (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    day_of_week TINYINT UNSIGNED NOT NULL,
    is_closed   BOOLEAN NOT NULL DEFAULT FALSE,
    opens_at    TIME NULL,
    closes_at   TIME NULL,
    break_start TIME NULL,                           -- pause déjeuner (facultative)
    break_end   TIME NULL,
    created_at  TIMESTAMP NULL,
    updated_at  TIMESTAMP NULL,
    UNIQUE KEY business_hours_day_unique (day_of_week),
    CONSTRAINT business_hours_day_chk   CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT business_hours_open_chk  CHECK (is_closed = TRUE OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at)),
    CONSTRAINT business_hours_break_chk CHECK (break_start IS NULL OR (break_end IS NOT NULL AND break_start < break_end))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fermetures exceptionnelles (jours fériés, Tabaski, Korité, inventaire…).
CREATE TABLE closures (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    starts_on  DATE NOT NULL,
    ends_on    DATE NOT NULL,
    reason     VARCHAR(191) NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    KEY closures_period_index (starts_on, ends_on),
    CONSTRAINT closures_period_chk CHECK (starts_on <= ends_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indisponibilités d'un coiffeur (congés, maladie, formation).
CREATE TABLE stylist_time_off (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    stylist_id BIGINT UNSIGNED NOT NULL,
    starts_at  DATETIME NOT NULL,
    ends_at    DATETIME NOT NULL,
    reason     VARCHAR(191) NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    KEY stylist_time_off_period_index (stylist_id, starts_at, ends_at),
    CONSTRAINT sto_stylist_fk FOREIGN KEY (stylist_id) REFERENCES stylists (id) ON DELETE CASCADE,
    CONSTRAINT sto_period_chk CHECK (starts_at < ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bookings (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference           VARCHAR(30) NOT NULL,         -- 'RDV-2026-000045' (code donné à l'invité)
    customer_id         BIGINT UNSIGNED NOT NULL,
    service_id          BIGINT UNSIGNED NOT NULL,
    stylist_id          BIGINT UNSIGNED NOT NULL,     -- « peu importe » => le système en affecte un
    source              ENUM('online','phone','walk_in') NOT NULL DEFAULT 'online',
    status              ENUM('pending','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'pending',
    starts_at           DATETIME NOT NULL,
    ends_at             DATETIME NOT NULL,            -- starts_at + durée + battement
    -- Instantanés de la prestation au moment de la réservation
    service_name        VARCHAR(150) NOT NULL,
    duration_minutes    SMALLINT UNSIGNED NOT NULL,
    price               INT UNSIGNED NOT NULL,
    customer_notes      VARCHAR(500) NULL,
    admin_notes         VARCHAR(500) NULL,
    cancellation_reason VARCHAR(255) NULL,
    cancelled_by        ENUM('customer','staff','system') NULL,
    confirmed_at        DATETIME NULL,
    completed_at        DATETIME NULL,
    cancelled_at        DATETIME NULL,
    reminder_sent_at    DATETIME NULL,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,
    -- Colonne GÉNÉRÉE : vaut starts_at si la réservation bloque le créneau, sinon NULL.
    -- Combinée à l'index UNIQUE ci-dessous, elle interdit deux réservations actives
    -- commençant au même instant pour le même coiffeur (MySQL accepte plusieurs NULL dans un index unique).
    -- Le contrôle complet du CHEVAUCHEMENT est fait dans une transaction (DATABASE.md §6.3).
    active_slot         DATETIME AS (IF(status IN ('pending','confirmed'), starts_at, NULL)) STORED,
    UNIQUE KEY bookings_reference_unique (reference),
    UNIQUE KEY bookings_stylist_active_slot_unique (stylist_id, active_slot),
    KEY bookings_stylist_period_index (stylist_id, starts_at, ends_at),  -- recherche de disponibilités
    KEY bookings_status_starts_index (status, starts_at),                 -- planning, statistiques
    KEY bookings_customer_index (customer_id, starts_at),
    KEY bookings_service_index (service_id),
    CONSTRAINT bookings_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
    CONSTRAINT bookings_service_fk  FOREIGN KEY (service_id)  REFERENCES services (id)  ON DELETE RESTRICT,
    CONSTRAINT bookings_stylist_fk  FOREIGN KEY (stylist_id)  REFERENCES stylists (id)  ON DELETE RESTRICT,
    CONSTRAINT bookings_period_chk  CHECK (starts_at < ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
--  DOMAINE 6 — PARAMÈTRES ET CONTACT
-- =====================================================================

-- Paramètres clé/valeur modifiables depuis l'ERP (horizon de réservation, TVA, coordonnées…).
CREATE TABLE settings (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `group`    VARCHAR(50)  NOT NULL,                -- 'company', 'booking', 'tax', 'shop'
    `key`      VARCHAR(100) NOT NULL,                -- 'booking.min_notice_minutes'
    value      JSON NOT NULL,                        -- 120
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    UNIQUE KEY settings_key_unique (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contact_messages (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    email      VARCHAR(191) NULL,
    phone      VARCHAR(20)  NULL,
    subject    VARCHAR(191) NOT NULL,
    message    TEXT NOT NULL,
    ip_address VARCHAR(45) NULL,                     -- 45 caractères : compatible IPv6 (anti-spam)
    handled_by BIGINT UNSIGNED NULL,
    read_at    TIMESTAMP NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    KEY contact_messages_read_index (read_at),
    CONSTRAINT contact_messages_handled_by_fk FOREIGN KEY (handled_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
--  DOMAINE 7 — ANALYTICS (couche OLAP simplifiée, ADR-008)
-- =====================================================================

-- DIMENSION CALENDRIER : une ligne par jour. Permet d'afficher les jours SANS vente (valeur 0)
-- et de grouper facilement par semaine, mois, trimestre, jour de la semaine.
CREATE TABLE calendar_dates (
    date         DATE PRIMARY KEY,
    year         SMALLINT UNSIGNED NOT NULL,
    quarter      TINYINT UNSIGNED NOT NULL,
    month        TINYINT UNSIGNED NOT NULL,
    iso_week     TINYINT UNSIGNED NOT NULL,
    day_of_month TINYINT UNSIGNED NOT NULL,
    day_of_week  TINYINT UNSIGNED NOT NULL,          -- 1 = lundi … 7 = dimanche
    is_weekend   BOOLEAN NOT NULL,
    KEY calendar_dates_year_month_index (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FAITS QUOTIDIENS GLOBAUX : recalculés chaque nuit par un job planifié.
CREATE TABLE daily_sales_snapshots (
    date               DATE PRIMARY KEY,
    orders_count       INT UNSIGNED NOT NULL DEFAULT 0,  -- commandes payées du jour
    items_sold         INT UNSIGNED NOT NULL DEFAULT 0,
    products_revenue   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    products_cost      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    gross_margin       BIGINT NOT NULL DEFAULT 0,          -- peut être négative (vente à perte)
    bookings_count     INT UNSIGNED NOT NULL DEFAULT 0,    -- réservations prévues ce jour
    bookings_completed INT UNSIGNED NOT NULL DEFAULT 0,
    bookings_no_show   INT UNSIGNED NOT NULL DEFAULT 0,
    services_revenue   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    new_customers      INT UNSIGNED NOT NULL DEFAULT 0,
    computed_at        TIMESTAMP NULL,
    CONSTRAINT dss_date_fk FOREIGN KEY (date) REFERENCES calendar_dates (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FAITS QUOTIDIENS PAR PRODUIT : base des top produits, de la rotation et des prévisions.
CREATE TABLE daily_product_stats (
    date          DATE NOT NULL,
    product_id    BIGINT UNSIGNED NOT NULL,
    quantity_sold INT UNSIGNED NOT NULL DEFAULT 0,
    revenue       BIGINT UNSIGNED NOT NULL DEFAULT 0,
    cost          BIGINT UNSIGNED NOT NULL DEFAULT 0,
    stock_end     INT UNSIGNED NOT NULL DEFAULT 0,      -- stock en fin de journée
    computed_at   TIMESTAMP NULL,
    PRIMARY KEY (date, product_id),
    KEY dps_product_date_index (product_id, date),
    CONSTRAINT dps_date_fk    FOREIGN KEY (date)       REFERENCES calendar_dates (date),
    CONSTRAINT dps_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PRÉVISIONS : remplie aujourd'hui par une moyenne mobile, demain par un modèle de Machine Learning.
CREATE TABLE forecasts (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    metric          VARCHAR(50) NOT NULL,              -- 'product_demand', 'revenue', 'bookings'
    product_id      BIGINT UNSIGNED NULL,              -- NULL pour une prévision globale
    target_date     DATE NOT NULL,
    predicted_value DECIMAL(14,2) NOT NULL,
    lower_bound     DECIMAL(14,2) NULL,                -- intervalle de confiance
    upper_bound     DECIMAL(14,2) NULL,
    model_name      VARCHAR(100) NOT NULL,             -- 'moving_average_30d', 'prophet'
    model_version   VARCHAR(50)  NOT NULL,
    generated_at    DATETIME NOT NULL,
    KEY forecasts_lookup_index (metric, product_id, target_date),
    CONSTRAINT forecasts_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
