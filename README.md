# GestSchool V2

GestSchool est une application SaaS de gestion scolaire en monorepo.

- Frontend admin : `Frontend/web-admin` (React, Vite, TypeScript).
- API et worker : `Backend/api` (NestJS, Prisma, PostgreSQL).
- Infrastructure locale : `Infrastructure/docker`.
- Documentation projet : `docs`.

## Prérequis

- Node.js 22 recommandé.
- pnpm 10.24.0, version déclarée dans `package.json`.
- Docker pour PostgreSQL et Redis locaux.
- Un client PostgreSQL est utile, mais pas obligatoire pour lancer l'application.

Le runbook complet de développement local est disponible dans `docs/local-development.md`.

## Installation

```bash
pnpm install
```

Créer les fichiers d'environnement locaux depuis les exemples :

```bash
cp Backend/api/.env.example Backend/api/.env
cp Frontend/web-admin/.env.example Frontend/web-admin/.env
```

Les fichiers `.env` locaux ne doivent jamais être commités. Les secrets réels doivent rester dans GitHub Actions, Render, Vercel ou le gestionnaire de secrets cible.

## Infrastructure locale

```bash
docker compose -f Infrastructure/docker/docker-compose.dev.yml up -d
```

Arrêt :

```bash
docker compose -f Infrastructure/docker/docker-compose.dev.yml down
```

## Base de données

Depuis la racine du repo :

```bash
pnpm --filter @gestschool/api prisma:generate
pnpm --filter @gestschool/api db:migrate:deploy
pnpm --filter @gestschool/api db:seed:minimal
pnpm --filter @gestschool/api db:seed:users
```

Les comptes de développement sont définis dans `Backend/api/.env.example`. Ne documentez pas de mots de passe réels dans le README ou les runbooks.

## Lancer l'application

API :

```bash
pnpm dev:api
```

Worker :

```bash
pnpm dev:worker
```

Web admin :

```bash
pnpm dev:web
```

Par défaut, l'API expose les routes sous `/api/v1`. Le web admin lit son URL API via `Frontend/web-admin/.env`.

## Commandes utiles

Backend :

```bash
pnpm --filter @gestschool/api lint
pnpm --filter @gestschool/api build
pnpm --filter @gestschool/api prisma:generate
```

Frontend :

```bash
pnpm --filter @gestschool/web-admin lint
pnpm --filter @gestschool/web-admin test
pnpm --filter @gestschool/web-admin test:smoke
pnpm --filter @gestschool/web-admin build
```

Global :

```bash
pnpm lint
pnpm build
pnpm visual:audit:core
git diff --check
```

La recette visuelle `visual:audit:core` vérifie les écrans Tableau de bord, Mon profil, Notes & bulletins, Comptabilité et Élèves en mode aperçu local. Elle écrit les captures et le rapport JSON dans `/tmp/gestschool-core-visual-audit/<run-id>`.

## Tests e2e API avec PostgreSQL

Les tests e2e backend exigent une base jetable dédiée dont le nom ou l'hôte contient `test`, `e2e` ou `jest`.

Exemple avec une base locale jetable :

```bash
export TEST_DATABASE_URL="postgresql://<user>:<password>@localhost:5432/gestschool_test"
export TEST_DIRECT_URL="$TEST_DATABASE_URL"
export DATABASE_URL="$TEST_DATABASE_URL"
export DIRECT_URL="$TEST_DIRECT_URL"

pnpm --filter @gestschool/api test:e2e:db:fresh
```

Ne lancez jamais ces tests contre une base de recette ou de production.

## Points de contrôle locaux

- API health : `http://localhost:3000/api/v1/health`
- API readiness : `http://localhost:3000/api/v1/health/ready`
- Swagger local si activé : `http://localhost:3000/api/docs`
- Web admin Vite : port affiché par `pnpm dev:web`

## Déploiement

- Render : `render.yaml`
- Vercel : `vercel.json`
- Guide : `docs/deployment-github-vercel-render.md`

Les services Render/Vercel ne doivent pas recevoir de secrets inutiles côté client. Les clés Supabase service role, Brevo, PayDunya et tokens de monitoring restent côté backend ou CI.

## Documentation

- Structure réelle du repo : `docs/project-structure.md`
- Développement local : `docs/local-development.md`
- Sécurité runtime backend : `docs/backend-runtime-safety.md`
- Hotspots techniques : `docs/technical-hotspots.md`
- Source of truth académique : `docs/academic-source-of-truth.md`
- Storage Supabase : `docs/providers/supabase-storage.md`
- PayDunya : `docs/providers/paydunya.md`
- Brevo : `docs/providers/brevo.md`
- Runbooks : `docs/runbooks/`

## Règles de contribution

- Ne commitez pas `.env`, dumps SQL, captures privées, bundles locaux ou archives outils.
- Gardez les changements métier séparés des changements de style ou documentation.
- Ajoutez ou adaptez les tests quand un flux utilisateur, une règle métier ou une validation backend change.
- Préférez les chemins actuels `Frontend/web-admin` et `Backend/api`; les anciens chemins `apps/*` ne sont plus la source de vérité.
