# Product Interface Draft

Document de référence pour les futurs échanges entre l’interface et les services produit.

## Familles

### Lire la famille active

Retourne la famille, le plan et les limites associées.

### Mettre à jour la famille

Met à jour le nom, la devise ou les préférences.

## Dettes

### Lister les dettes

Retourne les dettes de la famille active.

### Créer une dette

Champs attendus:

```json
{
  "name": "Carte Visa",
  "balanceCents": 485000,
  "interestRate": 19.99,
  "minimumPaymentCents": 14500
}
```

### Supprimer une dette

Retire une dette du suivi familial.

## Budget

### Lister les catégories

Retourne les catégories du budget familial.

### Créer une catégorie

Ajoute une catégorie de budget.

## Transactions

### Lister les transactions

Filtres possibles:

- `from`
- `to`
- `categoryId`

### Créer une transaction

Ajoute une dépense, un revenu ou un paiement.

## Objectifs

### Lister les objectifs

Retourne les objectifs de la famille.

### Créer un objectif

Ajoute un objectif commun ou personnel.

## Membres

### Lister les membres

Retourne les membres de la famille.

### Inviter un membre

Invite une personne selon les limites du plan.

## Facturation

### Démarrer un abonnement

Crée un parcours de souscription pour le plan sélectionné.

### Gérer l’abonnement

Permet de modifier ou annuler le plan.
