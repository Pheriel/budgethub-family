# API Documentation Draft

Draft pour une future API. Aucune API réelle n'est incluse dans cette phase frontend.

## Base URL future

```text
/api
```

## Auth

Toutes les routes privées devront recevoir une session utilisateur valide.

```http
Authorization: Bearer <token>
```

## Families

### GET /families/current

Retourne la famille active, le plan et les limites.

### PATCH /families/current

Met à jour les préférences de la famille.

## Debts

### GET /debts

Liste les dettes de la famille.

### POST /debts

Crée une dette. Le serveur doit vérifier la limite du plan.

```json
{
  "name": "Carte Visa",
  "balanceCents": 485000,
  "interestRate": 19.99,
  "minimumPaymentCents": 14500
}
```

### DELETE /debts/:id

Supprime une dette.

## Budget

### GET /budget/categories

Liste les catégories de budget.

### POST /budget/categories

Crée une catégorie.

## Transactions

### GET /transactions

Paramètres possibles:

- `from`
- `to`
- `categoryId`

### POST /transactions

Crée une transaction.

## Goals

### GET /goals

Liste les objectifs.

### POST /goals

Crée un objectif.

## Family Members

### GET /members

Liste les membres.

### POST /members/invite

Invite un membre. Le serveur doit vérifier la limite du plan.

## Billing

### POST /billing/create-checkout-session

Crée une session Stripe Checkout côté serveur.

### POST /billing/create-portal-session

Crée une session Stripe Customer Portal.

### POST /webhooks/stripe

Reçoit les événements Stripe. Cette route doit utiliser la vérification de signature Stripe.
