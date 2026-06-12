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
- Prices used by checkout: 12 full-price recurring Prices
- Coupons used by checkout/upgrades: 3 automatic duration coupons
- Currencies: CAD as base currency, USD and EUR as `currency_options`
- Discounts by billing cycle: monthly 0%, quarterly 5%, semiannual 10%, yearly 15%

Discount architecture: Stripe receives full-price Prices and an automatic coupon for 3m/6m/12m durations. This makes the discount visible in Stripe Checkout, invoices and receipts instead of hiding it inside a net Price amount.

## Expected displayed and Checkout amounts

Each amount is identical in CAD, USD and EUR because Stripe Prices use CAD as the base currency with USD/EUR `currency_options`.

| Plan | Monthly | Quarterly | Semiannual | Yearly |
|---|---:|---:|---:|---:|
| Solo | 10.00 | 28.50 | 54.00 | 102.00 |
| Family | 15.00 | 42.75 | 81.00 | 153.00 |
| Family Plus | 20.00 | 57.00 | 108.00 | 204.00 |

## Required coupon variables

```text
STRIPE_COUPON_QUARTERLY=
STRIPE_COUPON_SEMIANNUAL=
STRIPE_COUPON_YEARLY=
```

Current Live coupons:

```text
STRIPE_COUPON_QUARTERLY=PcisuySV
STRIPE_COUPON_SEMIANNUAL=M7ZRJhVk
STRIPE_COUPON_YEARLY=uhYsAx0v
```

## Upgrade rules

The backend only allows upgrades while keeping the same billing duration:

- Solo -> Family
- Solo -> Family Plus
- Family -> Family Plus

Downgrades and cancellation-to-free are not handled as upgrades. Stripe calculates the prorated difference with `proration_behavior=always_invoice`; the preview and the confirmation share the same `proration_date`, so the charged amount equals the previewed amount. The duration coupon is only attached when the subscription does not already carry a discount (existing discounts are never overwritten). Supabase syncs from the updated Stripe subscription/webhooks; when a subscription runs on an archived/legacy Price that is no longer in the environment variables, the plan is resolved from `subscription.metadata.plan`.

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
