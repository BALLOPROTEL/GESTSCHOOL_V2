# LOT 10C-B - Preparation du bac a sable de production controle

Date du controle : 2026-08-01. Ce rapport ne contient ni secret, ni donnee
nominative, ni resultat invente d'un service externe.

## Verdict immediat

- Push de `main` : **NO-GO** tant que Vercel Git n'est pas deconnecte et que
  Render n'affiche pas `Auto-Deploy: Off` dans son tableau de bord.
- Migration : **NO-GO** sans autorisation separee, sauvegarde chiffree et
  restauration jetable prouvee.
- Deploiement sur l'environnement actuel : **NO-GO conditionnel** jusqu'aux
  controles base, Supabase et donnees courantes ci-dessous.
- Aucun utilisateur ou donnee reelle n'a ete detecte par les controles locaux.
  Cette absence n'est cependant pas prouvable sans lecture de la base courante.
  L'operateur declare que les donnees actuelles sont exclusivement fictives.

## Preflight constate

- branche `main`, HEAD `42b10e1` ; le depot local est 17 commits devant
  `origin/main` ;
- l'historique GitHub montre des deploiements Vercel Production crees par le bot
  Vercel apres les pushes de `main` ;
- `origin/main` contient encore `autoDeploy: true` dans `render.yaml` ;
- le Blueprint local utilise desormais `autoDeployTrigger: off`, mais ce fichier
  ne peut pas desactiver a lui seul l'integration du service deja cree avant son
  prochain deploiement ;
- aucun `.env`, dump, cle privee, build, upload ou log n'est suivi par Git ;
- le dernier snapshot audite en lecture seule comptait 758 lignes tenant dans
  18 tables sur 42, toutes sous le tenant historique, sans collision ni tenant
  inattendu. Ce snapshot ne prouve pas l'etat courant ni la nature fictive des
  comptes.

## Configuration temporaire fail-closed

L'API mono-instance peut traiter l'outbox sans worker uniquement avec toutes les
valeurs suivantes :

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

Le validateur et les deux services runtime refusent le demarrage si une seule
condition de securite manque. Retirer cette exception avant le premier compte
reel, un provider externe ou une deuxieme instance.

Avant le push, neutraliser sans ambiguite l'ancienne release Render :

1. passer Render `Auto-Deploy` a `Off` ;
2. mettre `OUTBOX_IN_PROCESS_ENABLED=false` puis redemarrer l'ancienne API ;
3. mettre les providers notifications sur `MOCK`, les canaux et le webhook a
   `false`, le SMS reel a `false` et le paiement sur `mock` ;
4. retirer les secrets Brevo et PayDunya inutilises du bac a sable ;
5. ne remettre l'outbox en processus qu'apres migration et deploiement du code
   contenant la politique fail-closed.

## Sauvegarde et restauration obligatoires

Executer depuis un poste securise possedant PostgreSQL 16, `age` et Docker. Les
valeurs restent hors Git et hors historique shell partage.

```bash
GESTSCHOOL_BACKUP_ENVIRONMENT=production \
BACKUP_DATABASE_URL="$DIRECT_URL" \
BACKUP_DIR=/chemin/chiffre/gestschool \
BACKUP_ENCRYPTION_RECIPIENT='<age-recipient-public>' \
BACKUP_RETENTION_DAYS=30 \
Infrastructure/scripts/backup-postgres.sh
```

Creer ensuite une base Docker jetable suffixee `_restore_check`, puis verifier
le checksum, restaurer et controler Prisma :

```bash
RESTORE_DATABASE_URL="$RESTORE_DATABASE_URL" \
RESTORE_DIRECT_URL="$RESTORE_DATABASE_URL" \
RESTORE_CONFIRM_DATABASE=gestschool_restore_check \
BACKUP_AGE_IDENTITY_FILE=/chemin/prive/age-identity \
Infrastructure/scripts/restore-postgres.sh /chemin/chiffre/<archive>.dump.age
```

Une archive non restaurable, un checksum invalide ou un `migrate status`
divergent impose l'arret. Conserver archive, manifeste et SHA-256 hors Git.

## Supabase Storage, lecture seule avant migration

Verifier dans le tableau de bord du projet actuel :

- `gestschool-documents` existe et `public=false` ;
- `gestschool-avatars` existe et `public=false` ;
- aucune policy anonyme n'autorise `select`, `insert`, `update` ou `delete` ;
- la service-role existe uniquement dans Render API ;
- `SUPABASE_STORAGE_AVATARS_PUBLIC=false` ;
- `SUPABASE_STORAGE_SIGNED_URL_TTL_SECONDS=300` ;
- une requete anonyme vers un objet connu est refusee ; une URL signee expire
  apres 300 secondes.

Lancer uniquement le dry-run historique apres LOT 1C :

```bash
pnpm --filter @gestschool/api storage:migrate:dry-run -- \
  --manifest=/chemin/prive/manifest-approuve.json
```

Le manifest, le journal JSONL et les rapports restent hors Git. Aucun `apply`,
aucune suppression et aucune migration des deux avatars dans ce lot.

## Migration 31 a 35, apres autorisation separee

1. bloquer tout acces et toute ecriture ;
2. confirmer la restauration ci-dessus ;
3. executer le preflight en lecture sur la base courante et verifier cible
   canonique absente, 42 tables, zero `NULL`, zero tenant inattendu ;
4. construire l'image autonome depuis le SHA approuve :

```bash
docker build --target migration \
  --build-arg VCS_REF=42b10e1 \
  -t gestschool-migration:42b10e1 \
  -f Backend/api/Dockerfile .
```

5. appliquer une seule fois avec un fichier d'environnement prive et un reseau
   controle :

```bash
docker run --rm --network '<reseau-db>' \
  --env-file /chemin/prive/migration.env \
  gestschool-migration:42b10e1
docker run --rm --network '<reseau-db>' \
  --env-file /chemin/prive/migration.env \
  gestschool-migration:42b10e1 \
  node scripts/prisma-command.cjs migrate status
```

6. exiger 35 migrations appliquees, 0 ancien tenant dans les 42 colonnes,
   tenant canonique present et invariants relationnels inchanges ;
7. ne pas rouvrir l'application si un controle echoue.

## Deploiement coordonne

1. couper auto-deploiements et mettre l'environnement en maintenance ;
2. neutraliser outbox, notifications et paiement de l'ancienne release ;
3. sauvegarder, restaurer, preflight puis migrer ;
4. mettre a jour simultanement `DEFAULT_TENANT_ID`, stockage, Redis, CORS et la
   configuration fail-closed dans Render ;
5. deployer manuellement l'API au SHA exact, sans migration au build ;
6. verifier `/health/live`, `/health/ready`, Redis, auth, proxy et rate limit ;
7. verifier upload prive, refus anonyme et URL signee ;
8. deployer manuellement le frontend avec
   `VITE_API_BASE_URL=https://gestschool-ylik.onrender.com/api/v1` et
   `VITE_STORAGE_ASSET_ORIGIN=https://<project-ref>.supabase.co` ;
9. verifier CSP, CORS, FR/EN/AR, RTL, responsive et absence d'erreur console ;
10. seulement alors autoriser les essais fonctionnels fictifs.

## Smoke tests et arret

Tester login, refresh, logout, logout-all, revocation, eleve, parent,
enseignant, inscription, paiement `mock`, notes, absences, bulletin, upload
prive, acces anonyme refuse et outbox traitee sans appel externe.

Arreter immediatement en cas de migration divergente, readiness non verte,
Redis indisponible, CORS/CSP inattendu, acces anonyme a un objet, provider reel,
tenant historique residuel ou erreur cross-tenant.

Rollback avant reprise des ecritures : redeployer l'ancien SHA, laisser outbox
et providers coupes, restaurer la sauvegarde dans une base separee validee puis
repointage controle. Apres reprise des ecritures, ne jamais restaurer par-dessus
la base courante : nouvelle maintenance et reconciliation obligatoire.

## Remise a zero avant ouverture officielle

Ce plan est separe et ne doit pas etre execute maintenant :

1. sauvegarder une derniere fois les donnees fictives ;
2. bloquer toutes les ecritures et inventorier les volumes ;
3. tester sur copie un script transactionnel avec garde d'environnement et
   confirmation explicite, qui conserve `_prisma_migrations` et les donnees de
   configuration approuvees ;
4. supprimer les donnees metier dans l'ordre des relations, sans toucher aux
   objets Supabase avant inventaire ;
5. recreer uniquement le compte administrateur officiel par un secret hors Git ;
6. verifier sequences, contraintes, 42 tables tenant, stockage et audit ;
7. executer les smoke tests puis ouvrir le trafic.

Aucun script destructif n'a ete cree ou execute pendant le LOT 10C-B.

## Variables a saisir manuellement

Render API, valeurs non secretes imposees : la configuration fail-closed
ci-dessus, `DEFAULT_TENANT_ID=00000000-0000-4000-8000-000000000001`,
`STORAGE_PROVIDER=supabase`, `FILE_STORAGE_DRIVER=SUPABASE`, les deux buckets
prives, TTL signe `300`, `TRUST_PROXY_HOPS=1`, `RATE_LIMIT_DISABLED=false`,
`CORS_ORIGINS=https://gestschool.vercel.app` et
`AUTH_PUBLIC_BASE_URL=https://gestschool.vercel.app`.

Secrets Render a verifier sans les copier dans un rapport : `DATABASE_URL`,
`DIRECT_URL`, `REDIS_URL`, `JWT_SECRET`, `PASSWORD_RESET_SECRET`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`MONITORING_METRICS_TOKEN`, `NOTIFICATION_WEBHOOK_SECRET` et
`NOTIFICATION_WEBHOOK_SIGNING_SECRET`. Les secrets Brevo et PayDunya ne sont
pas necessaires dans ce bac a sable desactive.

Vercel Production :

```env
VITE_API_BASE_URL=https://gestschool-ylik.onrender.com/api/v1
VITE_STORAGE_ASSET_ORIGIN=https://<project-ref>.supabase.co
VITE_FEATURE_MESSAGES=false
VITE_FEATURE_MOSQUEE=false
VITE_FEATURE_STUDENT_PORTAL=false
VITE_FEATURE_USER_BILLING=false
```

Le build refuse volontairement l'absence de `VITE_STORAGE_ASSET_ORIGIN`. La
valeur exacte du projet Supabase est donc un preflight obligatoire, pas un
fallback.
