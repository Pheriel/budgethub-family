# Stripe production checklist

BudgetHub Family uses Stripe Checkout Sessions in subscription mode. The backend sends `customer_email`, `client_reference_id`, plan metadata, duration metadata, selected currency and legal policy text to Stripe.

## Dashboard settings to enable

1. Go to Stripe Dashboard > Settings > Business > Public details.
2. Add the BudgetHub Family logo from `assets/logo.svg` or export it as PNG if Stripe asks for a raster image.
3. Set support email to `support@budgethubfamily.com`.
4. Set website to `https://budgethubfamily.com`.
5. Add legal URLs:
   - Terms: `https://budgethubfamily.com/terms`
   - Privacy: `https://budgethubfamily.com/privacy`
   - Refund policy: `https://budgethubfamily.com/refund-policy`
6. Go to Stripe Dashboard > Settings > Billing > Customer emails.
7. Enable successful payment emails, receipts and invoice emails.
8. Enable failed payment emails if you want Stripe dunning emails.
9. Go to Stripe Dashboard > Settings > Billing > Invoices and confirm invoice numbering is enabled for the live account.

## Webhook endpoint

Create one live webhook endpoint:

```text
https://budgethubfamily.com/api/billing/webhook
```

Subscribe it to:

```text
checkout.session.completed
invoice.paid
invoice.payment_failed
customer.subscription.updated
customer.subscription.deleted
```

Copy the signing secret into `STRIPE_WEBHOOK_SECRET` on Hostinger.

## Customer email and receipts

The app sends the connected account email to Checkout as `customer_email`. Stripe then creates a Customer for the subscription and can send invoice/receipt emails automatically when the Dashboard customer email settings are enabled.

Stripe invoice/receipt emails include the invoice number, plan/line item, amount, currency, date and payment status. The customer can access Stripe-hosted invoice and receipt pages from those emails.

## Refund policy shown to customers

The site shows the refund policy in the footer, `/refund-policy`, pricing cards and Checkout submit text:

- Refunds may be requested only within 7 days after the initial purchase.
- After 7 days, no refund is offered except where required by law.
- Subscriptions can be canceled before renewal.
- Cancellation keeps access until the end of the already paid period.
- No prorated refund is offered except where required by law.
