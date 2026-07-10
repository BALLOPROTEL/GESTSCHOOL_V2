# 🕌 Al Manarat Islamiyat — Site Web Complet

Site web institutionnel complet pour l'École Al Manarat Islamiyat avec site public multi-pages, dashboard admin sécurisé, API REST et base de données.

---

## 🚀 Démarrage Rapide

### Prérequis
- **Node.js** v18+
- **npm** v9+

### Installation

```bash
# 1. Aller dans le dossier server
cd Frontend/al-manarat-website/server

# 2. Installer les dépendances
npm install

# 3. Créer la configuration locale
cp .env.example .env

# 4. Renseigner au minimum JWT_SECRET, CMS_ADMIN_EMAIL et CMS_ADMIN_PASSWORD

# 5. Démarrer le serveur
npm start
```

Le site est accessible sur : **http://localhost:3001**
Le dashboard admin : **http://localhost:3001/admin-site/login.html**
La passerelle GestSchool : **http://localhost:3001/acces-scolaire**

### Mode développement (rechargement auto)

```bash
npm run dev
```

---

## 🔐 Compte Admin Initial

Le premier compte CMS est créé au démarrage avec :

- `CMS_ADMIN_EMAIL`
- `CMS_ADMIN_PASSWORD`

En production, `CMS_ADMIN_PASSWORD` est obligatoire. Ne versionnez jamais le fichier `.env`.

---

## 📁 Structure du Projet

```
Frontend/al-manarat-website/
│
├── server/                    ← Backend Node.js + Express
│   ├── index.js               ← Point d'entrée serveur (port 3001)
│   ├── database.js            ← Collections NeDB + seed initial
│   ├── database-init.js       ← Shim d'initialisation
│   ├── package.json           ← Dépendances npm
│   ├── middleware/
│   │   ├── auth.js            ← JWT middleware
│   │   └── upload.js          ← Multer (fichiers)
│   └── routes/
│       ├── auth.js            ← POST /api/admin/login
│       ├── articles.js        ← CRUD articles
│       ├── events.js          ← CRUD événements
│       ├── gallery.js         ← CRUD galerie média
│       ├── applications.js    ← Candidatures
│       ├── contacts.js        ← Messages contact
│       ├── newsletter.js      ← Newsletter + export CSV
│       └── settings.js        ← Paramètres site + stats
│
├── admin/                     ← Dashboard Admin (HTML)
│   ├── login.html
│   ├── dashboard.html
│   ├── articles.html
│   ├── article-form.html
│   ├── evenements.html
│   ├── evenement-form.html
│   ├── galerie.html
│   ├── candidatures.html
│   ├── candidature-detail.html
│   ├── messages.html
│   ├── newsletter.html
│   └── parametres.html
│
├── pages/                     ← Pages publiques
│   ├── a-propos.html
│   ├── acces-scolaire.html    ← Passerelle vers GestSchool
│   ├── scolarite.html
│   ├── admissions.html
│   ├── actualites.html
│   ├── actualite-detail.html
│   ├── evenements.html
│   ├── evenement-detail.html
│   ├── galerie.html
│   └── contact.html
│
├── css/
│   ├── shared.css             ← Variables + composants communs
│   └── admin.css              ← Styles dashboard admin
│
├── js/
│   ├── api.js                 ← Client HTTP centralisé
│   ├── admin.js               ← Logique commune admin
│   └── auth.js                ← Gestion JWT côté client
│
├── assets/                    ← Images statiques
├── uploads/                   ← Fichiers uploadés (auto-créé)
├── data/                      ← Base de données NeDB (auto-créé)
│
├── index.html                 ← Page d'accueil
├── styles.css                 ← Styles homepage
├── script.js                  ← JS homepage
└── README.md                  ← Ce fichier
```

---

## 🔌 Routes API

Le préfixe canonique en production domaine unique est `/api/site`.
L'ancien préfixe `/api` reste disponible temporairement pour compatibilité locale et migration.

### Publiques (sans authentification)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/settings/public` | Paramètres publics de l'école |
| GET | `/api/articles` | Articles publiés (avec ?category=&page=&limit=) |
| GET | `/api/articles/:slug` | Détail d'un article |
| GET | `/api/events` | Événements (avec ?status=&featured=&limit=) |
| GET | `/api/events/:slug` | Détail d'un événement |
| GET | `/api/gallery` | Médias publiés (avec ?category=&limit=) |
| POST | `/api/applications` | Soumettre une candidature |
| POST | `/api/contacts` | Envoyer un message de contact |
| POST | `/api/newsletter` | S'inscrire à la newsletter |
| GET | `/api/health` | Vérifier l'état du serveur |
| GET | `/acces-scolaire` | Page passerelle publique vers GestSchool |

### Admin (JWT requis — `Authorization: Bearer <token>`)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/admin/login` | Connexion admin |
| POST | `/api/admin/change-password` | Changer le mot de passe |
| GET | `/api/settings/admin/stats` | Stats du tableau de bord |
| GET/PUT | `/api/settings/admin` | Paramètres du site |
| GET | `/api/articles/admin/all` | Tous les articles (brouillons inclus) |
| POST | `/api/articles` | Créer un article |
| PUT | `/api/articles/:id` | Modifier un article |
| DELETE | `/api/articles/:id` | Supprimer un article |
| PATCH | `/api/articles/:id/publish` | Publier/dépublier |
| GET | `/api/events/admin/all` | Tous les événements |
| POST | `/api/events` | Créer un événement |
| PUT | `/api/events/:id` | Modifier un événement |
| DELETE | `/api/events/:id` | Supprimer un événement |
| GET | `/api/gallery/admin/all` | Tous les médias |
| POST | `/api/gallery` | Upload un média |
| PUT | `/api/gallery/:id` | Modifier un média |
| DELETE | `/api/gallery/:id` | Supprimer un média |
| PATCH | `/api/gallery/:id/toggle` | Publier/masquer |
| GET | `/api/applications/admin/all` | Toutes les candidatures |
| GET | `/api/applications/admin/:id` | Détail candidature |
| PATCH | `/api/applications/admin/:id` | Mettre à jour statut/notes |
| GET | `/api/contacts/admin/all` | Tous les messages |
| PATCH | `/api/contacts/admin/:id/read` | Marquer lu/non lu |
| DELETE | `/api/contacts/admin/:id` | Supprimer un message |
| GET | `/api/newsletter/admin/all` | Liste des inscrits |
| GET | `/api/newsletter/admin/export` | Export CSV |
| DELETE | `/api/newsletter/admin/:id` | Désabonner |

---

## 🗄️ Base de Données

Utilise **NeDB** — une base de données embarquée pure JavaScript (pas de compilation native requise).

Les fichiers de données sont créés automatiquement dans `data/`:
- `data/admins.db` — Administrateurs
- `data/articles.db` — Articles
- `data/events.db` — Événements
- `data/gallery.db` — Galerie
- `data/applications.db` — Candidatures
- `data/contacts.db` — Messages de contact
- `data/newsletter.db` — Inscrits newsletter
- `data/settings.db` — Paramètres du site

---

## 🔒 Sécurité

- Tokens JWT avec expiration 24h
- Mots de passe hashés avec bcryptjs (salt rounds: 10)
- Routes admin protégées côté serveur
- Validation des entrées côté backend
- Upload limité à 20MB, types de fichiers contrôlés
- CORS configuré (à restreindre en production)

---

## 🚀 Déploiement en Production

1. Changer `JWT_SECRET` dans un fichier `.env`
2. Mettre `NODE_ENV=production`
3. Restreindre CORS à votre domaine
4. Changer le mot de passe admin par défaut
5. Configurer un reverse proxy (Nginx) devant le serveur Node
6. Sauvegarder régulièrement le dossier `data/`

### Variables d'environnement (.env)

```env
PORT=3001
JWT_SECRET=<long-random-secret>
CMS_ADMIN_EMAIL=<cms-admin-email>
CMS_ADMIN_PASSWORD=<initial-cms-admin-password>
NODE_ENV=production
CORS_ORIGIN=https://almanarat.example.com,https://www.almanarat.example.com
PUBLIC_SITE_URL=https://almanarat.example.com
GESTSCHOOL_BASE_PATH=/gestion
SITE_API_BASE_PATH=/api/site
GESTSCHOOL_URL=/gestion/login
```

---

## 🔗 Passerelle GestSchool

La page publique `/acces-scolaire` affiche un accès officiel vers l'application privée GestSchool.

- Elle ne demande pas d'email ni de mot de passe.
- Elle ne stocke aucun token GestSchool.
- Elle lit l'URL depuis le paramètre public `gestschool_url`.
- Si `gestschool_url` est absent ou invalide, un message indique de contacter l'administration.

Configuration recommandée :

1. Définir `GESTSCHOOL_URL` dans `.env` avant le premier démarrage, ou renseigner `gestschool_url` depuis l'admin CMS.
2. En production domaine unique, utiliser `/gestion/login`.
3. Garder l'authentification côté GestSchool. Le site public sert uniquement de passerelle.

Le plan de routage complet est documenté dans `../../docs/deployment-single-domain.md`.

## 🔗 Intégration future avec GestSchool

Les candidatures (`admission_applications`) sont conçues pour être liées à GestSchool :
- Le champ `level` correspond aux niveaux de GestSchool
- Le champ `cursus` correspond aux filières
- Une fois une candidature acceptée, elle peut être importée comme nouvel élève dans GestSchool

---

## 📝 Gestion du contenu (Admin)

1. **Articles** : Créer/modifier depuis `/admin-site/articles.html` → publier quand prêt
2. **Événements** : Gérer depuis `/admin-site/evenements.html` → marquer comme "passé" après l'événement
3. **Galerie** : Uploader des photos depuis `/admin-site/galerie.html` → catégoriser et publier
4. **Candidatures** : Gérer les dossiers depuis `/admin-site/candidatures.html` → changer le statut et ajouter des notes
5. **Paramètres** : Mettre à jour les infos de l'école depuis `/admin-site/parametres.html`
