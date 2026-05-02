# Runbook Migration / Rollback GestSchool_V2

Ce runbook est operationnel. Il sert a executer une migration ou une reprise legacy sur staging, puis a decider un go/no-go avant production. Aucune commande destructive ne doit etre lancee en production sans dry-run staging valide et validation humaine explicite.

## A. Preparation

### Preconditions

- Travailler depuis la racine du depot `GestSchool_V2`.
- Avoir `pnpm install --frozen-lockfile` deja passe.
- Avoir un etat Git lisible :

```bash
git status --short
```

- Identifier l'environnement cible : `local-e2e`, `staging`, ou `production`.
- Interdiction : ne pas utiliser une base production pour des e2e, un reset ou un dry-run destructif.

### Variables obligatoires

Backend :

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB"
export DIRECT_URL="$DATABASE_URL"
export TEST_DATABASE_URL="postgresql://gestschool:gestschool@localhost:55432/gestschool_e2e"
export TEST_DIRECT_URL="$TEST_DATABASE_URL"
export JWT_SECRET="..."
export DEFAULT_TENANT_ID="00000000-0000-0000-0000-000000000001"
export NOTIFICATIONS_WORKER_ENABLED="false"
```

Frontend :

```bash
export VITE_API_BASE_URL="https://gestschool-ylik.onrender.com/api/v1"
```

Render/Vercel a verifier :

- Render API : `DATABASE_URL`, `DIRECT_URL`, `CORS_ORIGINS`, `NODE_ENV`, `JWT_SECRET`.
- Render free : pas de worker separe obligatoire, `NOTIFICATIONS_WORKER_ENABLED=false`, `OUTBOX_IN_PROCESS_ENABLED=true`.
- Worker futur optionnel : meme DB, memes secrets providers, `OUTBOX_IN_PROCESS_ENABLED=false` cote API.
- Vercel : URL API cible, aucun ancien endpoint legacy.

### Sauvegarde DB obligatoire avant staging apply ou prod

Pour PostgreSQL :

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" --file "backups/gestschool-$(date +%Y%m%d-%H%M%S).dump"
```

Verifier que le fichier existe et n'est pas vide :

```bash
ls -lh backups/
```

Tester la restauration sur une base separee avant prod :

```bash
createdb gestschool_restore_check
pg_restore --dbname gestschool_restore_check --clean --if-exists backups/<backup>.dump
```

### Verifications avant migration

```bash
pnpm --filter @gestschool/api prisma:generate
pnpm --filter @gestschool/api db:status
pnpm --filter @gestschool/api audit:legacy -- --out=artifacts/legacy-inventory.json
pnpm --filter @gestschool/api dry-run:legacy -- --out=artifacts/precutover-dry-run.json
```

Go minimal avant toute migration :

- `db:status` ne signale pas de migration divergente.
- `precutover-dry-run.json` indique `readiness.schemaReady=true`.
- `readiness.businessDataReady=true` pour apply automatisable, sinon revue manuelle.

## B. Migration

Ordre standard staging :

```bash
pnpm --filter @gestschool/api prisma:generate
pnpm --filter @gestschool/api db:migrate:deploy
pnpm --filter @gestschool/api db:status
pnpm --filter @gestschool/api audit:precutover -- --out=artifacts/post-migration-audit.json
```

Si seeds necessaires :

```bash
pnpm --filter @gestschool/api db:seed:minimal
pnpm --filter @gestschool/api db:seed:users
```

Checks backend :

```bash
curl -i "$API_BASE_URL/health/live"
curl -i "$API_BASE_URL/health/ready"
pnpm --filter @gestschool/api lint
pnpm --filter @gestschool/api build
```

Checks frontend :

```bash
pnpm --filter @gestschool/web-admin lint
pnpm --filter @gestschool/web-admin test
pnpm --filter @gestschool/web-admin test:smoke
pnpm --filter @gestschool/web-admin build
```

Smoke checks manuels :

- Login admin.
- Liste eleves.
- Parents et liens parent-enfant.
- Inscriptions / placements.
- Notes / bulletins.
- Absences.
- Emploi du temps.
- Finance.
- Portail parent.
- Portail enseignant.

## C. Rollback

Declencher rollback si :

- API ne boote plus.
- Migration Prisma partiellement appliquee.
- Outbox in-process ou worker futur bloque la queue ou ecrit des donnees incoherentes.
- Frontend Vercel cible la mauvaise API.
- Audit post-migration revele une divergence de source de verite.
- Donnees metier incoherentes sur eleves/placements/notes/bulletins/finance.

### Rollback applicatif

Render :

1. Revenir au dernier deploy stable depuis le dashboard Render.
2. Redemarrer API.
3. Verifier :

```bash
curl -i "$API_BASE_URL/health/live"
curl -i "$API_BASE_URL/health/ready"
```

Vercel :

1. Revenir au dernier deployment stable.
2. Verifier la variable API.
3. Ouvrir l'application et tester login + dashboard.

### Rollback DB

Ne jamais faire un rollback DB partiel. Restaurer une sauvegarde complete dans une DB separee, puis repointer.

```bash
createdb gestschool_rollback_candidate
pg_restore --dbname gestschool_rollback_candidate --clean --if-exists backups/<backup>.dump
```

Verifier la DB restauree :

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/gestschool_rollback_candidate" \
DIRECT_URL="$DATABASE_URL" \
pnpm --filter @gestschool/api audit:precutover -- --out=artifacts/rollback-candidate-audit.json
```

Si l'audit est acceptable :

- Reconfigurer `DATABASE_URL` et `DIRECT_URL` Render vers la DB restauree.
- Redemarrer API.
- Si un worker separe existe plus tard, le redemarrer seulement apres validation API.
- Verifier Vercel.

## D. Incidents

### Migration echouee

- Stopper tout apply supplementaire.
- Capturer logs Prisma/Render.
- Lancer `pnpm --filter @gestschool/api db:status`.
- Restaurer backup si l'application ne peut pas booter.

### API boot fail

- Verifier `DATABASE_URL`, `DIRECT_URL`, secrets JWT, Redis.
- Verifier `pnpm --filter @gestschool/api build` localement.
- Revenir au dernier deploy stable si correction non immediate.

### Outbox / notifications fail

- Render free : desactiver temporairement `OUTBOX_IN_PROCESS_ENABLED=false`.
- Worker futur : desactiver temporairement `NOTIFICATIONS_WORKER_ENABLED=false`.
- Redemarrer le service concerne.
- Verifier qu'aucune queue ne traite en double.

### Vercel appelle mauvaise API

- Verifier `VITE_API_BASE_URL`.
- Redeployer frontend.
- Dans DevTools, verifier que les appels vont vers l'API attendue.
- Si CORS bloque, verifier `CORS_ORIGINS` cote Render et les headers autorises.

### Donnees incoherentes

- Ne pas corriger a la main en production.
- Produire un rapport :

```bash
pnpm --filter @gestschool/api audit:precutover -- --out=artifacts/inconsistency-report.json
```

- Corriger sur staging, rejouer dry-run, puis seulement appliquer.

## E. E2E Backend DB jetable

Base locale recommandee :

```bash
docker run --name gestschool-e2e-postgres \
  -e POSTGRES_USER=gestschool \
  -e POSTGRES_PASSWORD=gestschool \
  -e POSTGRES_DB=gestschool_e2e \
  -p 55432:5432 \
  -d postgres:16
```

Variables :

```bash
export TEST_DATABASE_URL="postgresql://gestschool:gestschool@localhost:55432/gestschool_e2e"
export TEST_DIRECT_URL="$TEST_DATABASE_URL"
```

Validation :

```bash
pnpm --filter @gestschool/api prisma:generate
pnpm --filter @gestschool/api db:status:test
pnpm --filter @gestschool/api test:e2e:db:fresh
```

Le garde-fou doit refuser toute DB dont le nom ou l'hote n'indique pas `test`, `e2e` ou `jest`.

## F. Dry-run Legacy / Staging

Objectif : distinguer `schema-ready` de `business-data-ready`.

Commandes read-only :

```bash
pnpm --filter @gestschool/api audit:legacy -- --out=artifacts/legacy-inventory.json
pnpm --filter @gestschool/api dry-run:legacy -- --out=artifacts/precutover-dry-run.json
```

Le rapport doit etre relu sur :

- referentiel academique
- eleves
- parents
- liens parent-enfant
- enseignants
- salles
- inscriptions
- placements `StudentTrackPlacement`
- notes / bulletins
- finance
- emploi du temps

Apply interdit tant que :

- `compatibilityLevel` n'est pas `READY_CANDIDATE`
- les ambiguites rooms/teacher assignments ne sont pas resolues
- les enrollments sans placement ou placements sans lien legacy ne sont pas compris
- aucun backup restaure n'a ete teste

## G. Checklist Go / No-Go

Go seulement si :

- `pnpm --filter @gestschool/api lint` passe.
- `pnpm --filter @gestschool/api build` passe.
- `pnpm --filter @gestschool/api test:e2e:db:fresh` passe sur DB jetable.
- `pnpm --filter @gestschool/web-admin lint` passe.
- `pnpm --filter @gestschool/web-admin test` passe.
- `pnpm --filter @gestschool/web-admin test:smoke` passe.
- `pnpm --filter @gestschool/web-admin build` passe.
- Backup cree et restauration testee si staging/prod.
- Runbook relu.
- Rapport dry-run archive.

No-go si :

- e2e backend non executes sur DB jetable.
- dry-run legacy absent.
- divergence source de verite detectee.
- rollback DB non testable.
- variables Render/Vercel non alignees.
