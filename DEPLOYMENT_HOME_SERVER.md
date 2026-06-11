# Deployment Home Server

BudgetHub Family peut être servi comme site statique sur un serveur maison, un hébergement web ou GitHub Pages.

## Fichiers à publier

- `index.html`
- `styles.css`
- `app.js`

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

## Checklist

- Publier uniquement les fichiers nécessaires
- Ne jamais publier `.env`
- Activer HTTPS pour un domaine public
- Garder des sauvegardes du dossier publié
- Vérifier le rendu mobile après chaque mise à jour
