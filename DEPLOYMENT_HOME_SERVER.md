# Deployment Home Server

Ce document prépare un futur déploiement maison. Le prototype actuel peut être servi comme site statique.

## Déploiement statique simple

Copier les fichiers suivants sur le serveur:

- `index.html`
- `styles.css`
- `app.js`

Puis servir le dossier avec Nginx, Caddy, Apache ou un serveur statique.

## Exemple Nginx

```nginx
server {
  listen 80;
  server_name budgethub.local;

  root /var/www/budgethub-family;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## Exemple Caddy

```caddyfile
budgethub.local {
  root * /var/www/budgethub-family
  file_server
}
```

## Préparation future backend

Quand Node.js sera ajouté:

- Servir le frontend statique depuis un reverse proxy.
- Exposer l'API sur `/api`.
- Garder Stripe secret keys uniquement côté serveur.
- Garder Supabase service role key uniquement côté serveur.
- Utiliser HTTPS, même sur un serveur maison exposé à Internet.

## Checklist sécurité

- Ne pas exposer `.env`.
- Ne pas committer de secrets.
- Activer HTTPS.
- Ajouter sauvegardes régulières.
- Mettre à jour le système et les dépendances.
- Limiter les ports ouverts.
