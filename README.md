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

## Plans

- Free: 0$, 1 membre, 2 dettes, données locales dans le navigateur
- Solo: 10$/mois, 1 utilisateur, dettes, budgets et objectifs illimités
- Family: 15$/mois, jusqu’à 5 membres, budget familial et objectifs communs
- Family Plus: 20$/mois, jusqu’à 10 membres, prévisions avancées, rapports et export PDF

## Lancer localement

Ouvrir directement:

```bash
index.html
```

Ou servir le dossier:

```bash
npm run dev
```

Puis ouvrir:

```text
http://localhost:5173
```

## Environnement

`.env.example` fournit un modèle de configuration locale. Le fichier `.env` est ignoré par Git et ne doit pas être commité.

## Remplir le fichier .env

Pour préparer le backend, copier `backend/.env.example` vers `backend/.env`, puis remplir les valeurs nécessaires sur le serveur:

```bash
cp backend/.env.example backend/.env
```

Le fichier `backend/.env` doit rester local au serveur et ne doit jamais être poussé dans Git.

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

## Structure

```text
.
├── index.html
├── styles.css
├── app.js
├── backend
│   ├── config
│   ├── controllers
│   ├── middleware
│   ├── routes
│   ├── services
│   ├── package.json
│   └── server.js
├── package.json
├── .gitignore
├── .env.example
├── README.md
├── ROADMAP.md
├── DEPLOYMENT_HOME_SERVER.md
├── DATABASE_SCHEMA_DRAFT.md
└── API_DOCUMENTATION_DRAFT.md
```
