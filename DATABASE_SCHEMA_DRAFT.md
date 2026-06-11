# Database Schema Draft

Document de conception pour les futures données produit.

## Entités principales

### users

- `id`
- `email`
- `full_name`
- `created_at`

### families

- `id`
- `name`
- `owner_user_id`
- `plan`
- `created_at`

### family_members

- `id`
- `family_id`
- `user_id`
- `role`
- `created_at`

### debts

- `id`
- `family_id`
- `name`
- `balance_cents`
- `interest_rate`
- `minimum_payment_cents`
- `created_at`
- `updated_at`

### budget_categories

- `id`
- `family_id`
- `name`
- `planned_cents`
- `period`
- `created_at`

### transactions

- `id`
- `family_id`
- `category_id`
- `description`
- `amount_cents`
- `transaction_date`
- `created_at`

### goals

- `id`
- `family_id`
- `name`
- `target_cents`
- `saved_cents`
- `target_date`
- `created_at`

### subscriptions

- `id`
- `family_id`
- `customer_id`
- `subscription_id`
- `status`
- `current_period_end`

## Règles de produit

- Un utilisateur voit uniquement les familles dont il est membre.
- Les admins gèrent les membres et le plan.
- Les limites Free, Solo, Family et Family Plus doivent être appliquées de façon centralisée.
