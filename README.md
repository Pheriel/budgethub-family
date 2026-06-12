# BudgetHub Family

BudgetHub Family est une interface SaaS moderne pour organiser les finances du foyer: dettes, budget, transactions, objectifs et membres de la famille.

## Fonctionnalités

- Landing page publique bilingue
- Tarifs Free, Solo, Family et Family Plus
- Connexion et inscription
- Démo gratuite
- Tableau de bord financier
- Gestion des dettes
- Comparaison Snowball et Avalanche
- Budget familial
- Transactions
- Objectifs
- Membres famille
- Paramètres
- Français et anglais
- CAD, USD et EUR
- Mode sombre
- Responsive mobile, tablette et desktop
- Footer complet avec pages légales bilingues
- Stripe Checkout avec webhooks abonnements/factures

## Plans

- Free: 0$, 1 membre, 2 dettes, données locales dans le navigateur
- Solo: 10$/mois, 1 utilisateur, dettes, budgets et objectifs illimités
- Family: 15$/mois, jusqu’à 5 membres, budget familial et objectifs communs
- Family Plus: 20$/mois, jusqu’à 10 membres, dettes, budgets, objectifs et suivi par membre illimités

## Lancer localement

```bash
npm install
npm run dev
```

Puis ouvrir:

```text
http://localhost:3000
```

## Environnement

`.env.example` fournit un modèle de configuration locale. Le fichier `.env` est ignoré par Git et ne doit pas être commité.

## Remplir le fichier .env

Pour préparer le serveur, copier `.env.example` vers `.env`, puis remplir les valeurs nécessaires sur Hostinger ou en local:

```bash
cp .env.example .env
```

Le fichier `.env` doit rester local au serveur et ne doit jamais être poussé dans Git.

## Diagnostics backend

Quand le backend est démarré, vérifier la santé du service:

```bash
curl http://localhost:3000/health
```

Vérifier que les variables obligatoires sont présentes, sans afficher leurs valeurs:

```bash
curl http://localhost:3000/api/diagnostics/config
```

Tester la connexion Supabase admin sans créer de table et sans modifier de données:

```bash
curl http://localhost:3000/api/diagnostics/supabase
```

Tester la clé Stripe test sans créer de paiement, customer, checkout session ou webhook:

```bash
curl http://localhost:3000/api/diagnostics/stripe
```

## Authentification et paiements (mode test)

Le frontend est connecté à Supabase Auth: la création de compte et la connexion utilisent la clé publishable (sûre côté client). Les nouveaux comptes reçoivent un courriel de confirmation et un lien « Mot de passe oublié » permet la réinitialisation. Le changement de mot de passe se fait dans Paramètres une fois connecté.

Les boutons de plans ouvrent Stripe Checkout en mode abonnement avec l'identifiant utilisateur (`client_reference_id`) et le courriel du compte connecté (`customer_email`). Pour tester un paiement, utiliser la carte de test Stripe `4242 4242 4242 4242` avec une date future et un CVC quelconque. Le webhook `POST /api/billing/webhook` synchronise le plan, les factures payées, les paiements échoués et les annulations dans la table `profiles`.

Voir `STRIPE_CHECKOUT_SETUP.md` pour les réglages manuels à activer dans Stripe: emails de reçus/factures, branding, URLs légales et événements webhook.

## Données utilisateur

Les visiteurs sans compte voient des données de démonstration locales. Les utilisateurs connectés démarrent avec un espace vide; leurs dettes, budget, transactions, objectifs et membres de famille sont enregistrés dans Supabase (tables `debts`, `budget_categories`, `transactions`, `goals`, `family_members`) protégés par Row Level Security: chaque utilisateur ne voit que ses propres données.

## Structure

```text
.
├── index.html
├── styles.css
├── app.js
├── server.js
├── assets
├── config
├── controllers
├── routes
├── services
├── scripts
├── supabase
├── package.json
├── .gitignore
├── .env.example
├── README.md
├── DEPLOYMENT_HOSTINGER.md
└── STRIPE_CHECKOUT_SETUP.md
```
