# BudgetHub Family

Prototype frontend statique du SaaS BudgetHub Family.

Cette phase ne contient pas de backend Node.js, pas de Stripe réel, pas de Supabase réel et aucune clé API. Toutes les données sont fictives et restent dans le navigateur.

## Stack

- HTML5
- CSS3
- JavaScript Vanilla
- Aucun framework applicatif

## Fonctionnalités incluses

- Landing page professionnelle
- Pricing: Free, Solo, Family, Family Plus
- Login/Register mock
- Dashboard applicatif
- Dettes avec limite de démo
- Comparaison Snowball/Avalanche
- Budget
- Transactions
- Objectifs
- Membres famille avec limite de démo
- Paramètres
- Français/Anglais
- CAD/USD/EUR
- Dark mode
- Responsive mobile, tablette et desktop

## Lancer localement

Option simple:

```bash
open index.html
```

Option serveur statique:

```bash
npm run dev
```

Puis ouvrir:

```text
http://localhost:5173
```

Le script `npm run dev` utilise `npx http-server` pour servir les fichiers statiques. Il ne démarre pas de backend applicatif.

## Variables d'environnement

Copier `.env.example` vers `.env` pour les essais locaux:

```bash
cp .env.example .env
```

Le fichier `.env` est ignoré par Git. Ne jamais y mettre de secrets réels pour ce prototype frontend.

## Structure

```text
.
├── index.html
├── styles.css
├── app.js
├── package.json
├── .gitignore
├── .env.example
├── README.md
├── ROADMAP.md
├── DEPLOYMENT_HOME_SERVER.md
├── DATABASE_SCHEMA_DRAFT.md
└── API_DOCUMENTATION_DRAFT.md
```

## Notes d'intégration future

- Remplacer les données mockées de `app.js` par des appels API.
- Brancher l'authentification Supabase ou une auth serveur quand la phase backend commence.
- Ajouter Stripe Checkout et le portail client côté backend uniquement.
- Faire respecter les limites de plan côté serveur, pas seulement côté frontend.
