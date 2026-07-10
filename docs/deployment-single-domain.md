# Déploiement domaine unique Al Manarat + GestSchool

Objectif : publier le site public, GestSchool, l'admin du site public et les API sous un seul domaine, sans mélanger les responsabilités métier.

## Routage cible

| Chemin | Application | Rôle |
| --- | --- | --- |
| `/` | `Frontend/al-manarat-website` | Site public Al Manarat |
| `/acces-scolaire` | `Frontend/al-manarat-website/pages/acces-scolaire.html` | Page passerelle vers GestSchool |
| `/gestion` | `Frontend/web-admin` | Application GestSchool |
| `/admin-site` | `Frontend/al-manarat-website/admin` | Admin du site public |
| `/api/v1` | `Backend/api` | API métier GestSchool |
| `/api/site` | `Frontend/al-manarat-website/server` | API site public et CMS |

## Décision d'architecture

Phase 1 utilise un reverse proxy qui route les chemins vers les services existants. Le proxy strippe le préfixe `/gestion` avant de servir l'application Vite GestSchool. Cela évite de reconstruire le front avec un `base` Vite fragile et permet aux refreshs profonds de fonctionner via les rewrites SPA existantes.

Phase 1 ne met pas encore le dashboard CMS sous SSO GestSchool. L'admin du site public reste protégé par son authentification actuelle, mais il est désormais accessible via `/admin-site` et documenté comme chemin cible.

Phase 2 devra centraliser l'accès admin du site public côté GestSchool, avec des permissions explicites :

- `website.admin.access`
- `website.content.read`
- `website.content.write`
- `website.gallery.manage`
- `website.events.manage`
- `website.applications.manage`
- `website.messages.manage`
- `website.newsletter.manage`
- `website.settings.manage`

## Configuration

Variables communes recommandées :

```env
PUBLIC_SITE_URL=https://almanarat.example.com
GESTSCHOOL_BASE_PATH=/gestion
GESTSCHOOL_API_BASE_PATH=/api/v1
SITE_API_BASE_PATH=/api/site
```

Site public :

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=<long secret>
CMS_ADMIN_EMAIL=<initial cms admin email>
CMS_ADMIN_PASSWORD=<initial cms admin password>
CORS_ORIGIN=https://almanarat.example.com,https://www.almanarat.example.com
GESTSCHOOL_URL=/gestion/login
```

Le blueprint `render.yaml` déclare également le service `al-manarat-public`. Les valeurs
`MONGODB_URI` et `CMS_ADMIN_PASSWORD` restent volontairement en `sync: false` et doivent
être saisies dans Render. Ne réutilisez pas la valeur d'exemple
`change-me-before-production`.

GestSchool API :

```env
NODE_ENV=production
CORS_ORIGINS=https://almanarat.example.com,https://www.almanarat.example.com
AUTH_PUBLIC_BASE_URL=https://almanarat.example.com/gestion
```

## Reverse proxy

Un exemple Nginx est disponible dans :

`Infrastructure/reverse-proxy/nginx.single-domain.conf`

Points importants :

- `/api/v1/` doit partir vers l'API Nest GestSchool.
- `/api/site/` doit partir vers le serveur Express du site public.
- `/gestion/` doit partir vers le front GestSchool en strippant le préfixe.
- `/admin-site/` doit partir vers l'admin du site public.
- `/` reste le site vitrine.

## Tests manuels de validation

À faire après déploiement ou en environnement proxy local :

1. Ouvrir `/` et vérifier le site public.
2. Vérifier que la navbar expose `Espace Scolaire`.
3. Ouvrir `/acces-scolaire`.
4. Cliquer vers GestSchool et vérifier l'arrivée sur `/gestion/login`.
5. Rafraîchir `/gestion/login` et une route interne GestSchool.
6. Vérifier `/api/v1/health/live`.
7. Vérifier `/api/site/health`.
8. Ouvrir `/admin-site/login.html`.
9. Vérifier desktop, tablette et mobile.
10. Vérifier qu'aucun fichier `data/`, `uploads/`, `.db`, `.env` ou `node_modules/` n'est suivi par Git.

## Limites connues

- L'admin du site public n'est pas encore gouverné par les rôles GestSchool. C'est volontaire en phase 1 pour éviter un SSO incomplet.
- Les pages, sections et blocs du CMS structuré utilisent MongoDB. L'authentification admin,
  les articles, les événements, la galerie et les soumissions utilisent encore NeDB. Sur un
  service Render sans disque persistant, ces données NeDB peuvent être recréées après un
  redéploiement. Ne considérez donc pas ces anciens modules comme durables en production
  avant leur bascule MongoDB ou l'ajout d'un disque persistant.
- Les anciens chemins `/admin` et `/api` du site public restent compatibles pendant la transition.
- Le lien GestSchool est stocké dans le paramètre public `gestschool_url`. En production domaine unique, sa valeur recommandée est `/gestion/login`.

## Prochaine étape

Phase 2 : créer un garde d'accès CMS basé sur la session GestSchool et une permission `website.admin.access`, puis déplacer progressivement les opérations CMS derrière les permissions fines ci-dessus.
