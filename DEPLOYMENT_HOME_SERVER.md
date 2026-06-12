# Deployment Hostinger / Node.js

BudgetHub Family est maintenant servi par Express à la racine du projet. Hostinger doit installer les dépendances puis lancer `npm start`.

## Commandes

```bash
npm install
npm start
```

## Fichier d'entrée

```text
server.js
```

## Variables

Copier `.env.example` vers `.env` sur le serveur et remplir les secrets Supabase/Stripe. Ne jamais commiter `.env`.

## Checklist

- Ne jamais publier `.env`
- Configurer le port Hostinger via `process.env.PORT`
- Vérifier `https://votre-domaine/health`
- Vérifier que `index.html`, `app.js` et `styles.css` sont servis par Express
