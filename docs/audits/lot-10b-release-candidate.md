# LOT 10B - Release candidate locale reproductible

Date de validation : 2026-07-29

## Perimetre

Cette validation couvre uniquement une release candidate locale et jetable.
Aucun appel n'a ete effectue vers Brevo, Supabase Cloud, Render ou Vercel.
Aucun email ou SMS reel n'a ete envoye. Aucun deploiement, push ou commit n'a
ete realise.

## Versions verifiees

| Composant | Version |
| --- | --- |
| Node.js | 22.22.0 dans les images finales |
| pnpm build/install | 10.24.0 |
| pnpm audit | 11.13.0 |
| Prisma | 6.19.3 |
| PostgreSQL | 16.14 |
| Redis | 7.4.7 |
| Prometheus | 2.54.1 |
| Trivy | 0.70.0 |
| Semgrep | 1.151.0 |
| Syft | 1.49.0 |
| Supabase local | depot officiel, commit `d845768fcf740cb13780341835e83a9f3f2b01a3` |
| Supabase Postgres | 17.6.1.136 |
| Supabase Storage API | 1.60.4 |
| Supabase Kong | 3.9.1 |

## Blocages LOT 10A et corrections

| Blocage | Cause racine | Correction LOT 10B | Preuve |
| --- | --- | --- | --- |
| Worker RC refuse avec providers MOCK | Le validateur assimilait toute execution `NODE_ENV=production` a la production reelle | Ajout de `GESTSCHOOL_RUNTIME_ENV` et d'une autorisation MOCK strictement limitee a RC | Matrice de demarrage testee |
| Image de migration telecharge Prisma au runtime | Les moteurs Prisma n'etaient pas embarques dans l'image finale | Moteurs 6.19.3, schema et 35 migrations copies au build | Migration et status sur reseau Docker `--internal` |
| Stockage seulement simule | Aucun test du contrat HTTP Supabase reel | Test contractuel depuis l'image API contre la pile Supabase officielle locale | 10 controles sur 10 |
| Frontend sans CSP appliquee | Les en-tetes de deploiement ne definissaient pas la politique complete | Politique partagee Vite/Vercel et test automatise | En-tetes verifies et zero violation sur l'audit HTTPS |
| Audit integre HTTP uniquement | Le runner officiel ne gerait pas la confiance TLS locale | Certificat RC local avec pin SPKI, uniquement en mode `rc` et pour un hote local | Audit integre HTTPS strict : 18/18 |
| Alertes non exercees | Les endpoints de metriques existaient mais les transitions d'alertes n'etaient pas testees | Scraping reel API/worker et tests Prometheus des transitions firing/recovery | Configuration valide, 10 regles, tests `SUCCESS` |

## Matrice providers

| Runtime | Canal | Provider accepte | Conditions |
| --- | --- | --- | --- |
| local/test | email ou SMS | MOCK | Configuration locale explicite |
| rc | email ou SMS | MOCK | `ALLOW_MOCK_NOTIFICATION_PROVIDERS_IN_RC=true` |
| staging | email | BREVO | Canal email active et credentials presents |
| staging email-only | SMS | MOCK | Canal SMS desactive, `BREVO_SMS_DRY_RUN=true`, `ALLOW_REAL_SMS=false` |
| production | canal active | provider reel uniquement | MOCK refuse dans tous les cas |
| production | canal desactive | aucun envoi | Le gateway retourne une erreur permanente `DISABLED` |

Le discriminateur RC ne desactive pas le validateur. Une valeur inconnue, un
MOCK non autorise ou des credentials absents sur un canal active font echouer
le demarrage.

## Images et migrations

Images finales testees :

- `gestschool-api:lot10b`
- `gestschool-worker:lot10b`
- `gestschool-migration:lot10b`

Les trois images configurent l'utilisateur `node`. L'image de migration contient
le schema, les 35 migrations, `schema-engine` et `libquery_engine` Prisma 6.19.3.
Sur un reseau Docker marque `--internal`, sans sortie Internet :

- 35 migrations sur 35 appliquees sur PostgreSQL vierge ;
- `prisma migrate status` : schema a jour ;
- aucun acces a `binaries.prisma.sh` ;
- sauvegarde PostgreSQL au format custom reussie ;
- restauration dans une seconde base jetable reussie ;
- controle de l'historique des migrations et smoke apres restauration reussi.

Preflights LOT 1C rejoues sur quatre clones jetables :

- base deja migree : `LOT1C_ALREADY_MIGRATED`, 26 lignes tenant techniques ;
- collision ancien/canonique : transaction bloquee ;
- tenant inattendu : transaction bloquee ;
- tenant `NULL` : transaction bloquee.

Les quatre clones ont ete supprimes. La base RC source n'a pas ete modifiee par
ces scenarios.

## Supabase Storage local

Le controle utilise la pile officielle Supabase locale et le provider compile
dans l'image API finale. Resultat : 10 controles sur 10.

- creation ou verification des buckets prives ;
- upload avatar ;
- upload document ;
- acces anonyme refuse ;
- URL signee lisible ;
- URL signee expiree refusee ;
- isolation inter-tenant ;
- objet absent refuse ;
- suppression verifiee ;
- compensation de l'objet apres echec PostgreSQL simule.

Les objets techniques de test sont nettoyes. La cle service-role reste
exclusivement dans l'environnement du conteneur de test et n'est ni affichee,
ni stockee dans le frontend, ni ajoutee a Git.

## Politique CSP appliquee

Politique exacte appliquee par la passerelle HTTPS de la RC locale :

```text
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://gestschool.local:5443; connect-src 'self' https://gestschool.local:5443; media-src 'self'; manifest-src 'self'; worker-src 'self' blob:; frame-src 'none'; upgrade-insecure-requests
```

`unsafe-eval` et les wildcards larges sont absents. Les en-tetes suivants sont
egalement appliques :

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `X-Frame-Options: DENY`

`VITE_API_BASE_URL` et `VITE_STORAGE_ASSET_ORIGIN` doivent etre des origines
HTTPS explicites hors developpement.

## Audits frontend

| Audit officiel | Resultat |
| --- | --- |
| Mocked CI | 67/67, zero constat |
| Mocked complet | 133/133, zero constat |
| Integre HTTPS | 18/18, zero constat |

Les audits n'ont detecte aucune erreur API inattendue, erreur console,
`pageerror` ou overflow. Le certificat local est accepte par pin SPKI seulement
en runtime `rc`, pour les hotes locaux autorises. Aucune desactivation globale
de TLS n'est utilisee.

Validations frontend :

- typecheck : reussi ;
- lint : reussi ;
- tests : 24 fichiers, 109 tests reussis ;
- build production explicite : reussi ;
- build sans URL API explicite : echec attendu ;
- smoke : reussi ;
- CSS final : 442,62 kB, 68,35 kB gzip ;
- JavaScript principal : 391,10 kB, 115,18 kB gzip.

La dette CSS existante de 1 196 `!important` reste documentee et n'a pas ete
elargie par ce lot.

## Backend, worker et resilience

- Prisma validate/generate : reussi ;
- API typecheck/lint/build : reussi ;
- unitaires API : 23 suites, 151 tests ;
- E2E PostgreSQL : 9 suites, 63 tests ;
- fiabilite notifications : 10 tests ;
- flux evenement -> outbox -> worker -> notification -> MOCK -> DELIVERED /
  PROCESSED : reussi ;
- Redis indisponible : readiness en echec puis retour normal ;
- PostgreSQL indisponible : readiness en echec puis retour normal ;
- configuration production invalide : demarrage refuse ;
- arret propre API et worker : reussi ;
- recuperation des leases : couverte par les tests de fiabilite.

## Prometheus et alertes

Prometheus a scrappe les cibles API et worker avec `up=1`. La syntaxe de la
configuration et des 10 regles est valide. Les tests couvrent :

- API indisponible ;
- worker indisponible ;
- worker bloque ;
- echec de traitement d'une notification ;
- retour de chaque alerte a l'etat normal apres recuperation.

Les logs runtime sont structures en JSON. Le validateur de production emet
egalement des evenements JSON et n'affiche pas les secrets. Le controle des logs
de la RC n'a trouve aucun motif sensible.

## Securite et supply chain

- audit pnpm production : zero avis ;
- audit complet : une exception haute dev-only controlee
  `GHSA-mh99-v99m-4gvg` sur `brace-expansion@1.1.16`, expiration
  `2026-08-11T23:59:59.999Z` ;
- dette faible : `GHSA-g7r4-m6w7-qqqr` sur `esbuild@0.27.3` ;
- tests de politique : 7/7, y compris l'echec simule apres expiration ;
- Semgrep : 318 fichiers, zero constat ;
- SBOM SPDX source et image API generes dans `/tmp` uniquement ;
- gate Trivy officiel (`CRITICAL,HIGH`, `ignore-unfixed=true`) : reussi pour
  API, worker et migration.

Le scan Trivy brut signale 22 avis Debian critiques/hauts sans correctif
disponible dans la base utilisee. Ils ne sont pas caches dans ce rapport. Ils
doivent etre reevalues avec une base Trivy et une image Node/Debian actualisees
avant staging. Le gate officiel reste bloque sur toute vulnerabilite corrigeable
critique ou haute.

## Configuration staging a preparer

API :

- `GESTSCHOOL_PROCESS_ROLE=api`
- `GESTSCHOOL_RUNTIME_ENV=staging`
- `NOTIFICATIONS_WORKER_ENABLED=false`
- `OUTBOX_IN_PROCESS_ENABLED=false`
- `NOTIFICATIONS_EMAIL_ENABLED=true`
- `NOTIFICATIONS_EMAIL_PROVIDER=BREVO`
- `NOTIFICATIONS_SMS_ENABLED=false`
- `NOTIFICATIONS_SMS_PROVIDER=MOCK`
- `BREVO_SMS_DRY_RUN=true`
- `ALLOW_REAL_SMS=false`

Worker :

- `GESTSCHOOL_PROCESS_ROLE=worker`
- `GESTSCHOOL_RUNTIME_ENV=staging`
- `NOTIFICATIONS_WORKER_ENABLED=true`
- `OUTBOX_IN_PROCESS_ENABLED=false`
- meme configuration email-only que l'API.

Frontend Preview et Production :

- `VITE_API_BASE_URL`
- `VITE_STORAGE_ASSET_ORIGIN`
- les quatre feature flags provisoires restent `false` sauf validation
  fonctionnelle explicite.

Secrets backend uniquement :

- URLs PostgreSQL directe et runtime ;
- `REDIS_URL` ;
- secrets JWT et reset ;
- cle service-role Supabase ;
- cle API Brevo ;
- secret webhook Brevo distinct ;
- token de metriques.

## Verdicts LOT 10B

- Release candidate locale : **GO avec reserve supply-chain OS**. Les fonctions,
  migrations, resilience, stockage local, HTTPS, CSP et alertes sont
  reproductibles. Les 22 avis Debian sans correctif imposent une reevaluation
  avant staging.
- Push vers une branche sans auto-deploiement : **GO technique**, sous reserve
  de revue du diff et sans environnement de deploiement attache.
- Recette staging : **NO-GO** tant que les secrets, buckets prives, sauvegarde,
  worker Render dedie, domaine HTTPS et reevaluation Trivy ne sont pas verifies.
- Production : **NO-GO**.

## Actions utilisateur avant staging

1. Verifier ou creer les deux buckets Supabase prives et leurs politiques.
2. Configurer les secrets API et worker separement, sans cle service-role dans
   Vercel.
3. Decider et provisionner le worker Render dedie.
4. Verifier une sauvegarde PostgreSQL puis restaurer une copie representative.
5. Executer le dry-run de migration des anciens fichiers sur cette copie.
6. Reevaluer les avis Debian sans correctif avec les images et la base Trivy du
   jour.
7. Executer la recette Brevo email-only avant toute activation SMS.
8. Configurer les origines HTTPS exactes du frontend dans CSP et CORS.
9. Relancer le LOT 10A integre en staging, sans allowlist visuelle.
