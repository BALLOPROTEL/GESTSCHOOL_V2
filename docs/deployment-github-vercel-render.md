# Deploiement controle GitHub, Render et Vercel

Ce document decrit la cible d'exploitation. Il ne declenche aucun deploiement.
Render Free reste utile pour une demonstration, mais n'est pas une cible de
production fiable : mise en veille, absence de worker gratuit et absence de job
pre-deploy controle. Le passage en production exige une decision de cout pour
l'API et le worker.

## Architecture cible

- Vercel sert uniquement le frontend compile.
- Un service Render web execute uniquement l'API.
- Un service Render background worker execute l'outbox et les notifications.
- PostgreSQL est la source de verite.
- Redis est obligatoire pour le rate limiting et la coordination runtime.
- Supabase Storage conserve les documents et avatars dans deux buckets prives.
- Brevo et les SMS restent desactives tant que la recette fournisseur n'est pas
  explicitement validee.

La configuration de processus est exclusive :

| Processus | `GESTSCHOOL_PROCESS_ROLE` | `NOTIFICATIONS_WORKER_ENABLED` | `OUTBOX_IN_PROCESS_ENABLED` |
| --- | --- | --- | --- |
| API | `api` | `false` | `false` |
| Worker | `worker` | `true` | `false` |

Le validateur refuse toute autre combinaison en production, sauf l'exception
explicite et temporaire du bac a sable vide decrite ci-dessous. Le fichier
`Infrastructure/render/worker.example.yaml` est volontairement separe du
`render.yaml` racine, car sa creation engage un service Render payant.

### Exception bac a sable actuel

Tant que l'environnement ne contient aucune donnee ou compte reel et reste sur
une seule instance API, il peut utiliser :

```env
GESTSCHOOL_RUNTIME_ENV=production
GESTSCHOOL_PROCESS_ROLE=api
WEB_CONCURRENCY=1
OUTBOX_IN_PROCESS_ENABLED=true
ALLOW_IN_PROCESS_OUTBOX_FOR_EMPTY_SANDBOX=true
NOTIFICATIONS_WORKER_ENABLED=false
NOTIFICATIONS_EMAIL_ENABLED=false
NOTIFICATIONS_SMS_ENABLED=false
NOTIFICATIONS_EMAIL_PROVIDER=MOCK
NOTIFICATIONS_SMS_PROVIDER=MOCK
BREVO_WEBHOOK_ENABLED=false
BREVO_SMS_DRY_RUN=true
ALLOW_REAL_SMS=false
PAYMENT_PROVIDER=mock
```

Le demarrage echoue si un canal/provider reel est active, si la concurrence
depasse un processus ou si le role change. Retirer cette exception avant la
premiere donnee reelle et revenir a la matrice API/worker cible.

## Separation build, migration et demarrage

Les commandes sont distinctes :

```bash
pnpm render:build:api
pnpm render:migrate:api
pnpm render:start:api
pnpm render:start:worker
```

Le build ne migre plus la base. La migration s'execute une fois dans le workflow
manuel `.github/workflows/production-migration.yml`, apres validation humaine de
l'environnement GitHub `production-database`, d'un SHA complet et d'une
reference de sauvegarde verifiee.

Sequence obligatoire :

1. figer le SHA et les images/digests ;
2. sauvegarder PostgreSQL et restaurer la sauvegarde sur une base jetable ;
3. inventorier Supabase Storage ;
4. lancer les audits pre-migration sur la copie ;
5. approuver l'environnement GitHub protege ;
6. appliquer la migration une seule fois ;
7. deployer l'API avec le meme SHA ;
8. valider liveness, readiness et smoke ;
9. deployer le worker avec le meme SHA ;
10. valider backlog, retries et dead-letter ;
11. deployer le frontend avec `VITE_API_BASE_URL` explicite ;
12. conserver l'ancienne release tant que la fenetre de rollback est ouverte.

## Render

`render.yaml` conserve `autoDeployTrigger: off`. Le champ historique
`autoDeploy` est deprecie par Render. Le tableau de bord Render reste la source
de verite pour un service deja cree : verifier **Settings > Auto-Deploy > Off**
avant tout push. L'API utilise :

- `healthCheckPath: /api/v1/health/ready` ;
- `TRUST_PROXY_HOPS=1` pour le proxy Render documente ;
- Redis `noeviction` dans la meme region ;
- `SWAGGER_ENABLED=false` ;
- Supabase Storage prive ;
- aucun traitement d'outbox dans le processus API cible ; seule l'exception
  mono-instance du bac a sable vide peut l'autoriser temporairement.

Le worker utilise `/health/live` et `/health/ready`. Il partage PostgreSQL,
Redis et les secrets providers avec l'API, mais ne recoit pas les variables
frontend. Il doit etre cree uniquement apres validation du cout Render.

## Vercel

L'integration Git actuelle cree un deploiement Production a chaque push de
`main`. Avant de pousser une branche contenant la release, deconnecter
temporairement le depot dans **Project > Settings > Git > Connected Git
Repository**. Un `Ignored Build Step` peut eviter un build, mais ne remplace pas
la deconnexion lorsqu'aucun deploiement ne doit etre cree.

Configurer separement Preview et Production :

```env
VITE_API_BASE_URL=https://<api-attendue>/api/v1
VITE_FEATURE_MESSAGES=false
VITE_FEATURE_MOSQUEE=false
VITE_FEATURE_STUDENT_PORTAL=false
VITE_FEATURE_USER_BILLING=false
```

Une preview ne doit jamais reutiliser silencieusement l'API de production. Aucun
secret backend (`SUPABASE_SERVICE_ROLE_KEY`, JWT, Brevo, PayDunya, monitoring)
ne doit exister dans Vercel.

## Controles post-deploiement

```bash
curl -fsS https://<api>/api/v1/health/live
curl -fsS https://<api>/api/v1/health/ready
curl -fsS -H "Authorization: Bearer $MONITORING_METRICS_TOKEN" \
  https://<api>/api/v1/monitoring/providers
```

Verifier ensuite login, revocation de session, dashboard, eleves, inscriptions,
finance, notes, upload/lecture/suppression Supabase, absence d'erreur console et
absence de requete frontend vers une origine inattendue.

## Rollback

- Application : redeployer les digests API/worker precedents, compatibles avec
  le schema additif.
- Base : ne jamais annuler manuellement une migration. Restaurer la sauvegarde
  dans une base separee, la valider, puis repointer pendant une fenetre approuvee.
- Frontend : promouvoir le dernier deploiement Vercel sain.
- Worker : l'arreter avant toute restauration pour eviter une ecriture concurrente.

Voir `docs/runbooks/deployment-rollback.md` et
`docs/runbooks/backup-restore.md`.
