# Stripe Audit - BudgetHub Family

Date: 2026-06-12

## Current architecture

BudgetHub Family uses Stripe Checkout Sessions in subscription mode.

Runtime Price IDs are now read from environment variables only. The application no longer stores concrete Stripe Price IDs in source code or documentation.

## Required Stripe variables

```text
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_SOLO_MONTHLY=
STRIPE_PRICE_SOLO_QUARTERLY=
STRIPE_PRICE_SOLO_SEMIANNUAL=
STRIPE_PRICE_SOLO_YEARLY=
STRIPE_PRICE_FAMILY_MONTHLY=
STRIPE_PRICE_FAMILY_QUARTERLY=
STRIPE_PRICE_FAMILY_SEMIANNUAL=
STRIPE_PRICE_FAMILY_YEARLY=
STRIPE_PRICE_FAMILY_PLUS_MONTHLY=
STRIPE_PRICE_FAMILY_PLUS_QUARTERLY=
STRIPE_PRICE_FAMILY_PLUS_SEMIANNUAL=
STRIPE_PRICE_FAMILY_PLUS_YEARLY=
```

`STRIPE_PUBLISHABLE_KEY` may be present for future Stripe.js work, but the current checkout integration does not need it because Checkout Sessions are created server-side and redirected by URL.

## Price mapping

The mapping is defined by environment variable names in `config/billing.prices.js`.

| Plan | Monthly | Quarterly | Semiannual | Yearly |
|---|---|---|---|---|
| Solo | `STRIPE_PRICE_SOLO_MONTHLY` | `STRIPE_PRICE_SOLO_QUARTERLY` | `STRIPE_PRICE_SOLO_SEMIANNUAL` | `STRIPE_PRICE_SOLO_YEARLY` |
| Family | `STRIPE_PRICE_FAMILY_MONTHLY` | `STRIPE_PRICE_FAMILY_QUARTERLY` | `STRIPE_PRICE_FAMILY_SEMIANNUAL` | `STRIPE_PRICE_FAMILY_YEARLY` |
| Family Plus | `STRIPE_PRICE_FAMILY_PLUS_MONTHLY` | `STRIPE_PRICE_FAMILY_PLUS_QUARTERLY` | `STRIPE_PRICE_FAMILY_PLUS_SEMIANNUAL` | `STRIPE_PRICE_FAMILY_PLUS_YEARLY` |

## Expected Stripe Live structure

- Products: 3
- Prices used by checkout: 12
- Currencies: CAD as base currency, USD and EUR as `currency_options`

## Webhook endpoint

```text
https://budgethubfamily.com/api/billing/webhook
```

Events handled by the backend:

```text
checkout.session.completed
invoice.paid
invoice.payment_failed
customer.subscription.updated
customer.subscription.deleted
```

## Live launch steps

1. Run `node scripts/create-stripe-live-products.js` with `STRIPE_SECRET_KEY=sk_live_...`.
2. Copy the 12 emitted `STRIPE_PRICE_*` variables into local `.env` and Hostinger.
3. Keep `STRIPE_WEBHOOK_SECRET` set to the Live webhook signing secret.
4. Run diagnostics:

```bash
curl https://budgethubfamily.com/health
curl https://budgethubfamily.com/api/diagnostics/config
```

5. Verify Checkout for at least Solo monthly, Family quarterly and Family Plus yearly in CAD, USD and EUR.
