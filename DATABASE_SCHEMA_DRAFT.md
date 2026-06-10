# Database Schema Draft

Draft conceptuel seulement. Aucune table Supabase n'a été créée dans cette phase.

## tables futures

### users

- `id` uuid primary key
- `email` text unique not null
- `full_name` text
- `created_at` timestamptz

### families

- `id` uuid primary key
- `name` text not null
- `owner_user_id` uuid references users(id)
- `plan` text default `free`
- `created_at` timestamptz

### family_members

- `id` uuid primary key
- `family_id` uuid references families(id)
- `user_id` uuid references users(id)
- `role` text
- `created_at` timestamptz

### debts

- `id` uuid primary key
- `family_id` uuid references families(id)
- `name` text not null
- `balance_cents` integer not null
- `interest_rate` numeric
- `minimum_payment_cents` integer
- `created_at` timestamptz
- `updated_at` timestamptz

### budget_categories

- `id` uuid primary key
- `family_id` uuid references families(id)
- `name` text not null
- `planned_cents` integer not null
- `period` text
- `created_at` timestamptz

### transactions

- `id` uuid primary key
- `family_id` uuid references families(id)
- `category_id` uuid references budget_categories(id)
- `description` text
- `amount_cents` integer not null
- `transaction_date` date not null
- `created_at` timestamptz

### goals

- `id` uuid primary key
- `family_id` uuid references families(id)
- `name` text not null
- `target_cents` integer not null
- `saved_cents` integer default 0
- `target_date` date
- `created_at` timestamptz

### subscriptions

- `id` uuid primary key
- `family_id` uuid references families(id)
- `stripe_customer_id` text
- `stripe_subscription_id` text
- `status` text
- `current_period_end` timestamptz

## RLS à prévoir

- Un utilisateur ne peut lire que les familles dont il est membre.
- Seuls les admins peuvent gérer les membres et la souscription.
- Les limites de plan doivent être validées côté serveur.
- Les webhooks Stripe doivent mettre à jour `subscriptions` et `families.plan`.
