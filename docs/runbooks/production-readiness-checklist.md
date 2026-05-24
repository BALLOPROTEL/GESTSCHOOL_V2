# Production Readiness Checklist

Cette checklist sert de go/no-go avant une recette client exposee, une mise en preproduction stable ou une mise en production GestSchool.

Elle ne remplace pas les runbooks detailles. Elle les assemble en une sequence verifiable autour des secrets, logs, backups, rollback, monitoring et stockage.

## Regle de decision

Ne pas ouvrir l'environnement si un point critique est rouge :

- secret manquant, faible, expose cote frontend ou visible dans les logs ;
- backup non teste ou restauration non repetee ;
- migration sans plan de rollback ;
- stockage document non durable en production ;
- endpoint public sensible non protege ;
- monitoring indisponible ;
- permissions IAM non verifiees pour les roles client.

## 1. Environnement et version

- Verifier la branche, le commit et le tag de livraison.
- Verifier que le build de reference est reproductible depuis un checkout propre.
- Noter les versions Node, pnpm, PostgreSQL, Prisma, Docker et services externes.
- Confirmer que `NODE_ENV=production` est bien pose cote API en production.
- Confirmer que le frontend pointe vers l'API attendue via `VITE_API_BASE_URL`.

Preuves attendues :

```bash
git rev-parse HEAD
pnpm install --frozen-lockfile
pnpm lint
pnpm build
git diff --check
```

## 2. Secrets et variables d'environnement

- Aucun fichier `.env` reel ne doit etre commite.
- Les secrets Render/API restent cote backend : JWT, Supabase service role, Brevo, PayDunya, metrics token, notification webhook secret.
- Vercel/front ne recoit que des variables publiques strictement necessaires, jamais de service role ou secret provider.
- `JWT_SECRET`, `NOTIFICATION_WEBHOOK_SECRET` et `MONITORING_METRICS_TOKEN` doivent etre longs, aleatoires et propres a l'environnement.
- Les secrets faibles de developpement doivent faire echouer le boot ou l'acces en production.
- Les logs ne doivent jamais contenir de token, hash password, refresh token, payload complet de credentials ou URL signee longue duree.

Controle minimum :

```bash
rg "password|secret|token|service_role|apikey|Authorization" README.md docs Backend/api/.env.example Frontend/web-admin/.env.example
```

## 3. Base de donnees, migrations et sauvegardes

- `DATABASE_URL` et `DIRECT_URL` ciblent la bonne base.
- Les migrations Prisma sont appliquees avec `migrate deploy`, pas `db push`.
- Une sauvegarde complete est realisee avant toute migration.
- Une restauration de cette sauvegarde est testee dans une base separee.
- Les tests e2e utilisent uniquement une base jetable contenant `test`, `e2e`, `jest` ou localhost.

Commandes de reference :

```bash
pnpm --filter @gestschool/api prisma:generate
pnpm --filter @gestschool/api db:migrate:deploy
pnpm --filter @gestschool/api db:status
pnpm --filter @gestschool/api test:e2e:db:fresh
```

Runbook detaille : `docs/runbooks/migration-rollback.md`.

## 4. Rollback

- Le rollback applicatif est documente : commit/tag precedent, artefact precedent, variables compatibles.
- Le rollback base de donnees est documente : restauration complete dans une base separee, puis repointage.
- Ne jamais faire de rollback partiel a la main en production.
- Le rollback est teste au moins une fois sur staging avec donnees anonymisees ou jeu representatif.

Declencher rollback si :

- l'API ne boote pas apres migration ;
- les healthchecks restent rouges ;
- une migration casse les droits d'acces ou les donnees scolaires ;
- les providers externes exposent un comportement non idempotent ;
- des secrets apparaissent dans logs ou reponses.

## 5. Monitoring, healthchecks et logs

- Health API : `/api/v1/health`.
- Readiness API : `/api/v1/health/ready`.
- Monitoring providers : `/api/v1/monitoring/providers` avec `x-metrics-token`.
- Les endpoints monitoring ne doivent retourner que des booleens/statuts, jamais des valeurs secretes.
- Les logs doivent permettre d'identifier erreurs API, auth, paiement, notification, storage et worker.
- Les logs sensibles doivent etre masques avant activation client.

Controle minimum :

```bash
curl -fsS "$API_URL/api/v1/health"
curl -fsS "$API_URL/api/v1/health/ready"
curl -fsS -H "x-metrics-token: <redacted>" "$API_URL/api/v1/monitoring/providers"
```

Runbook detaille : `docs/runbooks/post-deploy-render-vercel.md`.

## 6. Stockage documents

- Supabase Storage est le stockage durable cible en staging/production.
- Le stockage local est reserve au dev/test.
- Les buckets prives ne doivent pas etre exposes sans URL signee.
- Les descriptors stockent chemin, mime type, taille, nom fichier, proprietaire/contexte et dates.
- Les URLs signees doivent avoir une duree de vie limitee.
- La suppression ou regeneration de documents doit etre auditee quand le journal existe.

Controle minimum :

```bash
curl -fsS -H "x-metrics-token: <redacted>" "$API_URL/api/v1/monitoring/providers"
```

Runbook detaille : `docs/runbooks/storage.md`.

## 7. Providers externes

- Brevo email : dry-run des emails sensibles valide, expediteur valide, templates sans secret.
- SMS : dry-run conserve tant que sender ID, quotas et obligations legales ne sont pas valides.
- PayDunya : sandbox seulement tant que le flux production n'est pas valide humainement.
- Callbacks paiement : hash/verrou/idempotence/rate limit valides.
- Webhooks notification : secret obligatoire et compare constant-time.

Runbooks :

- `docs/providers/brevo.md`
- `docs/providers/paydunya.md`
- `docs/runbooks/payment-webhooks.md`

## 8. Securite endpoints publics

- Endpoints monitoring proteges par token robuste.
- Callbacks paiement proteges par signature/hash et idempotence.
- Webhooks notification proteges par secret et rate limit si disponible.
- Endpoints storage n'exposent pas de bucket prive ni de service key.
- Les erreurs publiques ne revelent pas de stack trace, secret, SQL, provider token ou details IAM.

Tests attendus :

```bash
pnpm --filter @gestschool/api test
pnpm --filter @gestschool/api test:e2e:db:fresh
```

## 9. Permissions et portails

- Verifier les roles `ADMIN`, `SCOLARITE`, `COMPTABLE`, `ENSEIGNANT`, `PARENT`, `STUDENT`.
- Verifier que billing, activity, profile et portails n'exposent pas les ressources internes aux mauvais roles.
- Un parent ne doit pas acceder aux endpoints admin factures/paiements.
- Un utilisateur peut modifier son profil autorise, mais jamais son role, tenant, statut, permissions ou password par endpoint profile.
- Les changements de mot de passe exigent l'ancien mot de passe et une politique forte.

## 10. Recette visuelle et fonctionnelle

- Dashboard : light/dark, desktop/tablette/mobile, pas de cadre externe, pas de scroll horizontal.
- Profil : menu utilisateur propre, upload avatar, informations personnelles, preferences, securite.
- Notes & bulletins : saisie, calcul, rangs, generation PDF, ouverture/telechargement.
- Finance : factures, paiements, recouvrement, statuts lisibles.
- Eleves : ajout, liste, validations, responsive.

Commandes de reference :

```bash
pnpm --filter @gestschool/web-admin lint
pnpm --filter @gestschool/web-admin test
pnpm --filter @gestschool/web-admin test:smoke
pnpm --filter @gestschool/web-admin build
pnpm visual:audit:core
```

Le rapport visuel global est ecrit dans `/tmp/gestschool-core-visual-audit/<run-id>/report.json`.

## 11. Donnees et confidentialite

- Ne jamais importer de donnees client reelles dans un environnement non securise.
- Les captures Playwright ne doivent pas contenir de donnees personnelles reelles avant partage.
- Les dumps SQL doivent etre chiffres ou stockes dans un emplacement controle.
- Les exports PDF et pieces jointes doivent avoir une politique de retention.

## 12. Go/no-go final

Go uniquement si :

- CI complete verte ;
- API e2e PostgreSQL verts ;
- recette visuelle globale sans finding P1 ;
- health/readiness verts ;
- monitoring providers verifie sans secret expose ;
- backup + restauration testes ;
- rollback applicatif et DB documente ;
- stockage durable valide ;
- permissions roles/portails verifiees ;
- aucun secret dans frontend, logs ou docs.

Consigner le resultat dans le ticket de release :

- commit/tag livre ;
- environnement ;
- date/heure ;
- personne validatrice ;
- liens CI ;
- chemin du rapport visuel ;
- chemin du backup ;
- incidents connus et decision go/no-go.
