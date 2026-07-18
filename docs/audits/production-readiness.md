# Journal de preparation a la production

Ce journal suit la feuille de route de production de GestSchool, lot par lot.
Chaque lot doit rester autonome et documenter les preuves, les modifications et les validations executees.

## LOT 0 - Retrait du site public Al Manarat

- Date : 2026-07-13
- Statut : termine avec reserves reportees
- Commit propose : `chore(repo): remove al-manarat public website`

### Anomalie

Le projet public `Frontend/al-manarat-website/` a ete retire du workspace pour recentrer le depot sur GestSchool, mais ses integrations de deploiement, de proxy, de documentation et d'environnement etaient encore suivies par Git.

### Correction

- Retrait complet du repertoire versionne `Frontend/al-manarat-website/`.
- Retrait du service Render `al-manarat-public`.
- Retrait des variables racine reservees a l'ancienne passerelle publique.
- Retrait des exclusions Git propres aux donnees d'execution de l'ancien site.
- Retrait de la configuration Nginx mono-domaine devenue inutilisable.
- Retrait de la documentation MongoDB CMS et mono-domaine devenue obsolete.

Les occurrences de `Al Manarat Islamiyat` conservees dans GestSchool sont des donnees de marque ou d'etablissement utilisees par le produit ; elles ne referencent pas l'ancien projet public.

### Fichiers concernes

- `Frontend/al-manarat-website/` : repertoire supprime.
- `render.yaml` : service public supprime.
- `.env.example` : variables de passerelle publique supprimees.
- `.gitignore` : exclusions specifiques au site public supprimees.
- `Infrastructure/reverse-proxy/nginx.single-domain.conf` : fichier supprime.
- `docs/al-manarat-mongodb-cms.md` : fichier supprime.
- `docs/deployment-single-domain.md` : fichier supprime.
- `docs/audits/production-readiness.md` : journal ajoute.

### Verifications du perimetre

| Controle | Resultat |
| --- | --- |
| Repertoire `Frontend/al-manarat-website/` absent du workspace | OK |
| Reference technique residuelle vers le site, son API, son admin ou sa base MongoDB | Aucune occurrence |
| Verification des espaces et conflits Git avec `git diff --check` | OK |
| Service Render restant | `gestschool-api` uniquement |

### Validations GestSchool

| Commande ou controle | Resultat |
| --- | --- |
| `pnpm install --frozen-lockfile` | OK, lockfile a jour |
| `pnpm --filter @gestschool/api prisma:generate` | OK, Prisma Client 6.19.2 genere |
| `pnpm --filter @gestschool/api lint` | OK |
| `pnpm --filter @gestschool/api build` | OK |
| `pnpm --filter @gestschool/api test:unit` | OK, 6 suites et 21 tests |
| Migrations PostgreSQL sur base isolee | OK, 30 migrations appliquees |
| `pnpm --filter @gestschool/api test:e2e` | OK, 6 suites et 33 tests |
| `pnpm --filter @gestschool/api db:status:test` | OK, schema a jour |
| `pnpm --filter @gestschool/web-admin lint` | OK |
| `pnpm --filter @gestschool/web-admin test` | OK, 15 fichiers et 64 tests |
| `pnpm --filter @gestschool/web-admin test:smoke` | OK |
| `pnpm --filter @gestschool/web-admin build` | OK |
| Audit visuel CI reduit | OK, 60 captures et 0 constat |
| `pnpm audit --prod` | ECHEC, 16 vulnerabilites : 8 hautes et 8 moderees |
| Validateur production avec la valeur Render de `DEFAULT_TENANT_ID` | ECHEC, UUID historique rejete |

Le premier lancement Prisma dans le bac a sable a retourne un `Schema engine error` avant migration, alors que PostgreSQL etait joignable. La meme commande executee avec l'acces local autorise a applique les 30 migrations, puis tous les tests E2E ont reussi. La base isolee `gestschool_test_lot0_20260713` a ete supprimee apres verification.

Le build Web Admin produit notamment un CSS principal de 443,53 kB et un JavaScript principal de 383,71 kB avant compression. Ces tailles ne bloquent pas le retrait du site public mais restent a traiter dans le LOT 8.

### Risques connus reportes aux lots suivants

- LOT 1 : `DEFAULT_TENANT_ID=00000000-0000-0000-0000-000000000001`, configure dans Render et la CI, est rejete par le validateur de production. Les cles etrangeres et donnees existantes doivent etre auditees avant correction.
- LOT 2 : `pnpm audit --prod` remonte 16 vulnerabilites, dont 8 hautes, dans des dependances transitives de NestJS et Prisma. Elles doivent etre traitees sans mise a jour forcee.
- LOT 7 : le script d'audit visuel contient encore une politique globale d'ignorance de certaines erreurs API locales ; ce comportement doit etre corrige dans son lot dedie.

### Migrations

Aucune migration de base de donnees n'est requise ni autorisee dans ce lot.

## LOT 1 - Identifiant du tenant de production

- Date : 2026-07-13
- Statut : compatibilite historique securisee ; migration canonique differee faute d'acces lecture a la production
- Commit propose : `fix(api): gate legacy default tenant compatibility`

### Diagnostic et scenario

Le schema ne contient ni modele Prisma `Tenant` ni table PostgreSQL proprietaire du tenant. Le champ `tenant_id` est une cle de partition applicative de type UUID repetee dans 42 tables. Aucune de ces colonnes ne porte de valeur par defaut et aucune cle etrangere ne la relie a une table tenant centrale.

Les environnements ne relevent pas tous du meme scenario :

- base locale : scenario C. L'identifiant historique est utilise par 60 lignes reparties dans 9 tables ; l'identifiant canonique cible n'est utilise par aucune ligne ;
- base de test avant E2E : schema complet, aucune ligne tenant ;
- production : scenario D. `DATABASE_URL` et `DIRECT_URL` sont `sync: false` dans Render et aucun acces PostgreSQL de production en lecture seule n'est disponible dans le workspace. Aucune conclusion sur les donnees de production n'a donc ete inventee.

Le scenario directeur est D. Conformement a la regle du lot, le remplacement de l'identifiant Render et la migration des donnees sont differes jusqu'a un inventaire de production sur connexion strictement en lecture.

### Inventaire

- 61 occurrences post-correction de `DEFAULT_TENANT_ID` ou de l'identifiant historique dans 23 fichiers actifs, tests, exemples, configuration et documentation.
- 2 050 occurrences de `tenantId` ou `tenant_id` dans 113 fichiers hors migrations historiques.
- 277 occurrences dans 24 migrations historiques, qui n'ont pas ete modifiees.
- 42 modeles Prisma portent `tenantId` : `Student`, `User`, `UserSecurityToken`, `RefreshToken`, `SchoolYear`, `Cycle`, `Level`, `Classroom`, `Subject`, `AcademicPeriod`, `SubjectLevelScope`, `Enrollment`, `StudentTrackPlacement`, `FeePlan`, `Invoice`, `Payment`, `PaymentProviderAttempt`, `GradeEntry`, `ReportCard`, `Attendance`, `AttendanceAttachment`, `TimetableSlot`, `PedagogicalRule`, `Notification`, `NotificationDeliveryAttempt`, `NotificationProviderCallback`, `Teacher`, `TeacherSkill`, `TeacherAssignment`, `TeacherDocument`, `RoomType`, `Room`, `RoomAssignment`, `RoomAvailability`, `ParentStudentLink`, `Parent`, `MosqueMember`, `MosqueActivity`, `MosqueDonation`, `RolePermission`, `IamAuditLog` et `OutboxEvent`.
- PostgreSQL local confirme 42 colonnes `tenant_id` : 41 obligatoires, `outbox_events.tenant_id` nullable, aucune valeur par defaut, aucune cle etrangere tenant, 33 contraintes uniques comprenant le tenant et 107 index comprenant le tenant.
- L'injection implicite passe principalement par `AuthService.getDefaultTenantId`, `resolveTenantContext`, `DevBootstrapUsersService`, les seeds Prisma, le harness E2E et `DEFAULT_TENANT` cote Web Admin.

Repartition locale de l'identifiant historique avant et apres validation : `academic_periods=3`, `cycles=2`, `levels=4`, `outbox_events=23`, `refresh_tokens=15`, `room_types=3`, `school_years=1`, `subjects=4`, `users=5`. Total : 60. Identifiant canonique `00000000-0000-4000-8000-000000000001` : 0 ligne.

### Correction retenue

- Le validateur continue d'exiger un UUID versionne pour toute nouvelle configuration.
- Une seule exception est admise : `00000000-0000-0000-0000-000000000001`.
- Cette exception ne fonctionne que si `ALLOW_LEGACY_DEFAULT_TENANT_ID=true` est explicitement configure.
- Render conserve provisoirement l'identifiant historique et active explicitement ce drapeau.
- Les fichiers `.env.example` placent le drapeau a `false`, afin qu'un nouvel environnement n'herite pas silencieusement de la dette.
- Le demarrage de production emet un avertissement explicite tant que l'exception est active.
- Un autre UUID de version 0, meme syntaxiquement bien forme, reste refuse.

Aucun contrat metier ni contrat API n'a ete modifie. Aucune donnee et aucune ancienne migration n'ont ete modifiees.

### Migration et plan de retrait

Aucune nouvelle migration de donnees n'est creee dans ce lot, car la production ne peut pas etre inspectee en lecture. Une migration aveugle serait contraire aux regles du lot et risquerait des collisions dans les contraintes uniques multi-tenant.

Le retrait de la compatibilite exige les etapes suivantes :

1. inventorier en lecture seule les valeurs tenant et volumes des 42 tables de production ;
2. verifier l'absence totale de la cible `00000000-0000-4000-8000-000000000001` ou traiter explicitement toute collision ;
3. creer une nouvelle migration transactionnelle qui met a jour les 42 colonnes et echoue avant toute ecriture si l'ancien et le nouveau tenant coexistent ;
4. verifier les 33 contraintes uniques, les 86 relations applicatives et l'absence de ligne historique apres migration ;
5. aligner Render, CI, seeds, exemples, frontend et scripts sur l'UUID versionne ;
6. supprimer `ALLOW_LEGACY_DEFAULT_TENANT_ID` et l'exception du validateur.

Rollback de la correction actuelle : retirer `ALLOW_LEGACY_DEFAULT_TENANT_ID` de Render uniquement apres retour au validateur precedent, ou reinstaller ensemble le validateur et la configuration actuels. La base n'a pas a etre restauree car ce lot ne l'a pas modifiee. Le futur rollback de migration devra effectuer l'operation inverse dans une transaction, apres controle que l'identifiant historique ne provoque aucune collision.

### Fichiers modifies

- `Backend/api/scripts/validate-production-env.cjs`
- `Backend/api/test/unit/production-env-validator.spec.ts`
- `render.yaml`
- `.env.example`
- `Backend/api/.env.example`
- `docs/audits/production-readiness.md`

### Validations

| Commande ou controle | Resultat |
| --- | --- |
| Recherche globale des identifiants et champs tenant | OK, inventaire ci-dessus |
| Catalogue PostgreSQL local | 42 colonnes, 0 FK tenant, 33 contraintes uniques, 107 index |
| Comptage local avant/apres | 60 historiques, 0 canoniques, inchange |
| Coherence tenant des relations | OK, 86 relations controlees, 0 divergence |
| Validateur avec UUID versionne | OK, aucune erreur ni avertissement |
| Validateur avec UUID historique et opt-in | OK, avertissement explicite |
| Validateur avec UUID historique sans opt-in | Refuse comme attendu |
| Validateur avec autre UUID non versionne | Refuse comme attendu |
| Validateur sans tenant | Refuse comme attendu |
| `pnpm --filter @gestschool/api test:unit -- production-env-validator.spec.ts` | OK, 10 tests |
| Migrations sur base neuve jetable | OK, 30 migrations, 42 colonnes tenant |
| `pnpm --filter @gestschool/api db:migrate:deploy` sur la base locale peuplee | OK, aucune migration en attente, donnees inchangees |
| `pnpm --filter @gestschool/api lint` | OK |
| `pnpm --filter @gestschool/api build` | OK |
| `pnpm --filter @gestschool/api test:unit` | OK, 6 suites et 25 tests |
| E2E PostgreSQL | OK, 6 suites et 33 tests |
| `pnpm --filter @gestschool/api db:status:test` | OK, schema a jour |

Deux lancements Prisma dans le bac a sable ont retourne `Schema engine error`; les memes commandes, executees avec l'acces PostgreSQL local autorise, ont reussi. Un premier lancement E2E sans `TEST_DATABASE_URL` a ete refuse par le garde-fou attendu. Une tentative Jest directe sans cette variable a egalement echoue sur les 6 suites ; la relance correctement configuree a produit un rapport JSON avec 6 suites et 33 tests reussis. Aucun de ces echecs n'est masque.

### Risques residuels et verdict

- L'identifiant historique reste actif tant que la production n'a pas ete auditee en lecture.
- L'absence de table `Tenant` et de FK tenant signifie que l'integrite multi-tenant repose encore sur l'application ; cette dette architecturale n'est pas elargie dans ce lot.
- Le drapeau Render est volontairement temporaire et doit etre retire en meme temps que la future migration canonique.

Verdict du LOT 1 : **GO pour lever le blocage du validateur sans casser les donnees connues, avec reserve obligatoire**. La migration definitive vers un UUID versionne reste **NO-GO** tant que la production releve du scenario D. Le LOT 2 ne doit pas commencer avant validation de ce compromis ou fourniture d'un acces production en lecture seule.

## LOT 2 - Dependances de production

- Date : 2026-07-15
- Statut : termine
- Commit propose : `fix(deps): remediate production dependency vulnerabilities`

### Diagnostic initial

`pnpm audit --prod` signalait 16 avis : 8 hauts et 8 moderes. Ils concernaient uniquement l'API NestJS. Le Web Admin React n'avait aucune dependance de production dans les chemins vulnerables.

Les imports applicatifs ne referencent directement aucun des paquets transitifs concernes. Leur exposition reelle etait la suivante :

- Multer est execute par `FileInterceptor` sur `POST /api/v1/users/me/avatar` ; le chemin multipart etait directement expose aux utilisateurs authentifies.
- `path-to-regexp` est execute par le routeur NestJS/Express pour toutes les routes API, dont les routes parametrees publiques et authentifiees.
- `qs` etait apporte par Express/body-parser. Les endpoints acceptent des query strings ; les DTO scalaires et le `ValidationPipe` global constituent la limite applicative.
- `file-type` est charge transitivement par `@nestjs/common`, sans import direct dans GestSchool.
- lodash et js-yaml etaient utilises par la configuration NestJS et Swagger, sans template lodash ni parsing YAML controle par un utilisateur dans le code GestSchool.
- Effect et defu etaient charges par la configuration Prisma CLI, pas par une logique metier importee dans le serveur compile. Ils restaient toutefois presents dans le graphe marque production par le peer Prisma de `@prisma/client`.

### Tableau avant/apres des 16 avis

| Avis | Severite | Chaine initiale | Version avant | Version apres | Resultat |
| --- | --- | --- | --- | --- | --- |
| GHSA-xf7r-hgr6-v32p - nettoyage de fichiers temporaires Multer | Haute | `API > @nestjs/platform-express > multer` | 2.0.2 | 2.2.0 | Corrige |
| GHSA-v52c-386h-88mc - epuisement de ressources Multer | Haute | `API > @nestjs/platform-express > multer` | 2.0.2 | 2.2.0 | Corrige |
| GHSA-5528-5vmv-3xc2 - recursion Multer | Haute | `API > @nestjs/platform-express > multer` | 2.0.2 | 2.2.0 | Corrige |
| GHSA-72gw-mp4g-v24j - champs multipart imbriques Multer | Haute | `API > @nestjs/platform-express > multer` | 2.0.2 | 2.2.0 | Corrige |
| GHSA-3p4h-7m6x-2hcm - upload interrompu Multer | Moderee | `API > @nestjs/platform-express > multer` | 2.0.2 | 2.2.0 | Corrige |
| GHSA-5v7r-6r5c-r473 - boucle infinie file-type | Moderee | `API > @nestjs/common > file-type` | 21.3.0 | 21.3.4 | Corrige |
| GHSA-j47w-4g3g-c36v - decompression excessive file-type | Moderee | `API > @nestjs/common > file-type` | 21.3.0 | 21.3.4 | Corrige |
| GHSA-q8mj-m7cp-5q26 - DoS qs | Moderee | `API > @nestjs/platform-express > express > qs` | 6.15.0 | 6.15.3 | Corrige |
| GHSA-j3q9-mxjg-w52f - DoS path-to-regexp | Haute | `API > @nestjs/core > path-to-regexp` | 8.3.0 | 8.4.2 | Corrige |
| GHSA-27v5-c462-wpq7 - ReDoS path-to-regexp | Moderee | `API > @nestjs/core > path-to-regexp` | 8.3.0 | 8.4.2 | Corrige |
| GHSA-36xv-jgw5-4q75 - neutralisation de sortie NestJS Core | Moderee | `API > @nestjs/core` | 11.1.13 | 11.1.28 | Corrige |
| GHSA-r5fr-rjxr-66jc - injection via lodash template | Haute | `API > @nestjs/config > lodash` | 4.17.23 | 4.18.1 | Corrige |
| GHSA-f23m-r3pf-42rh - pollution de prototype lodash | Moderee | `API > @nestjs/config > lodash` | 4.17.23 | 4.18.1 | Corrige |
| GHSA-h67p-54hq-rp68 - complexite quadratique js-yaml | Moderee | `API > @nestjs/swagger > js-yaml` | 4.1.1 | retire du graphe de production | Corrige |
| GHSA-737v-mqg7-c878 - pollution de prototype defu | Haute | `API > @prisma/client > prisma > @prisma/config > c12 > defu` | 6.1.4 | 6.1.7 | Corrige |
| GHSA-38f7-945m-qr2g - contamination AsyncLocalStorage Effect | Haute | `API > @prisma/client > prisma > @prisma/config > effect` | 3.18.4 | 3.21.0 | Corrige |

### Corrections et compatibilite

Les mises a jour ont ete appliquees par groupes, sans override et sans `--force` :

- uploads : `@nestjs/common` et `@nestjs/platform-express` 11.1.13 vers 11.1.28 ;
- framework : `@nestjs/core` et `@nestjs/testing` 11.1.13 vers 11.1.28 ;
- utilitaires/documentation : `@nestjs/config` 4.0.3 vers 4.0.4 et `@nestjs/swagger` 11.2.6 vers 11.4.5 ;
- Prisma : `prisma` et `@prisma/client` 6.19.2 vers 6.19.3.

Aucune mise a jour majeure n'a ete necessaire. Le saut Prisma 7.8.0 a ete explicitement evite : Prisma 6.19.3 fournit deja Effect 3.21.0 et permet la resolution de defu 6.1.7. Les contrats API et le schema Prisma n'ont pas change ; aucune migration n'est requise.

Le lockfile a ete regenere par pnpm pour ces versions et leurs transitives compatibles. Le controle CI execute desormais `pnpm audit --prod --audit-level high` apres `pnpm install --frozen-lockfile`. Le rapport natif complet reste visible dans les logs et le job bloque uniquement les niveaux haut et critique.

### Tests ajoutes

- Upload avatar multipart valide conserve.
- Rejet d'un avatar depassant 2 Mo : HTTP 413.
- Rejet de plusieurs fichiers avatar : HTTP 400.
- Rejet d'un MIME declare interdit : HTTP 400.
- Rejet d'une requete multipart malformee sans erreur serveur : HTTP 400.
- Rejet d'un parametre de route UUID malforme : HTTP 400.
- Erreur 404 structuree sur route inconnue.
- Rejet d'une query string imbriquee lorsque le DTO attend un UUID scalaire : HTTP 400.
- Rejet des proprietes de corps non autorisees par le `ValidationPipe` global : HTTP 400.

La validation de la signature binaire des avatars n'est pas ajoutee dans ce lot : elle fait partie du LOT 4, qui doit traiter ensemble coherence MIME/extension, limites par type et stockage prive. Le comportement actuel n'a pas ete presente comme plus fort qu'il ne l'est.

### Validations par groupe

Chaque groupe a passe l'installation figee, Prisma Generate, lint/build/tests unitaires API, E2E PostgreSQL, lint/tests/build/smoke frontend.

| Controle final | Resultat |
| --- | --- |
| `pnpm install --frozen-lockfile` | OK |
| `pnpm --filter @gestschool/api prisma:generate` | OK, Prisma Client 6.19.3 |
| `pnpm --filter @gestschool/api lint` | OK |
| `pnpm --filter @gestschool/api build` | OK |
| `pnpm --filter @gestschool/api test:unit` | OK, 6 suites et 25 tests |
| `pnpm --filter @gestschool/api test:e2e:db:fresh` | OK, 7 suites et 41 tests |
| `pnpm --filter @gestschool/web-admin lint` | OK |
| `pnpm --filter @gestschool/web-admin test` | OK, 15 fichiers et 64 tests |
| `pnpm --filter @gestschool/web-admin build` | OK |
| `pnpm --filter @gestschool/web-admin test:smoke` | OK |
| `pnpm audit --prod` | OK, aucune vulnerabilite connue |

Un premier E2E sans `TEST_DATABASE_URL` a ete refuse par le garde-fou attendu. Une premiere migration Prisma executee dans le bac a sable a retourne `Schema engine error` car l'acces reseau local etait isole ; la relance autorisee vers la base dediee `gestschool_test` a confirme les 30 migrations et tous les tests. Aucun echec applicatif n'a ete masque.

### Verdict et risques residuels

Verdict du LOT 2 : **GO**. Les dependances de production ne contiennent plus de vulnerabilite connue au moment du controle, et aucune fonctionnalite n'a ete retiree pour obtenir ce resultat.

Risques residuels : les dependances de developpement doivent rester surveillees par `pnpm audit` non bloquant tant qu'elles n'affectent pas l'artefact de production. Le gate CI de ce lot est volontairement limite a la production et aux niveaux haut/critique, conformement au perimetre. Toute future alerte moderee de production devra etre documentee avec son exposition et une echeance.

### Audit complet et outillage de developpement

Le controle final `pnpm audit` sans `--prod` reste en echec avec 52 constats : 1 critique, 28 hauts, 18 moderes et 5 faibles. `pnpm audit --prod` ne retrouve aucun de ces chemins : ils appartiennent aux outils de compilation, lint ou test, qui ne sont pas installes dans l'artefact de production. Ils ne sont donc pas melanges au verdict production, mais restent une dette de securite explicite.

| Paquet de developpement | Severite maximale | Chemin principal | Exposition constatee | Traitement et echeance |
| --- | --- | --- | --- | --- |
| handlebars 4.7.8 | Critique | `ts-jest > handlebars` | Compilation des tests uniquement ; aucune execution serveur | Mettre a jour ts-jest/sa chaine vers handlebars >=4.7.9 avant le LOT 10 |
| minimatch 3.1.2/9.0.5/10.2.1 | Haute | Nest CLI et TypeScript ESLint | Globs de build/lint locaux et CI | Mettre a jour Nest CLI et TypeScript ESLint en versions 11.x/8.x compatibles avant le LOT 10 |
| rollup 4.57.1 | Haute | `vite > rollup` | Bundling frontend, absent du bundle navigateur produit | Mettre a jour Vite 7.x et verrouiller rollup >=4.59.0 avant le LOT 10 |
| serialize-javascript 6.0.2 | Haute | `Nest CLI > webpack > terser-webpack-plugin` | Minification du build API uniquement | Suivre la mise a jour Nest CLI/webpack avant le LOT 10 |
| ajv 6.12.6/8.17.1 | Moderee | `Nest CLI > fork-ts-checker` et Angular Devkit | Validation de schemas des outils de build | Mettre a jour Nest CLI ; ne pas forcer AJV hors contraintes parentes, avant le LOT 10 |
| flatted 3.3.3 | Haute | `eslint > file-entry-cache` | Cache de lint local/CI | Mettre a jour ESLint/file-entry-cache dans leur branche compatible avant le LOT 10 |
| brace-expansion 1.1.12/2.0.2/5.0.2 | Moderee | Nest CLI et TypeScript ESLint via minimatch | Expansion de globs de build/lint | Traiter avec les parents minimatch, avant le LOT 10 |
| picomatch 2.3.1/4.0.2/4.0.3 | Haute | Jest types et Nest CLI | Selection de fichiers de test/build | Mettre a jour Jest types et Nest CLI sans resolution globale, avant le LOT 10 |
| vite 7.3.1 | Haute | dependance directe Web Admin | Serveur de developpement et build, jamais servi en production | Mettre a jour vers la derniere 7.x compatible et retester l'audit visuel avant le LOT 10 |
| postcss 8.5.6 | Moderee | `vite > postcss` | Transformation CSS au build | Traiter via Vite/PostCSS compatible avant le LOT 10 |
| fast-uri 3.1.0 | Haute | `Nest CLI > Angular Devkit > ajv` | Validation de schemas du CLI | Traiter via Nest CLI/Angular Devkit avant le LOT 10 |
| qs 6.15.0 | Moderee | `supertest > superagent > qs` | Client HTTP E2E uniquement ; le runtime Express utilise 6.15.3 corrige | Mettre a jour Supertest/Superagent dans leur branche compatible avant le LOT 10 |
| esbuild 0.27.3 | Faible | `vite > esbuild` | Serveur de developpement Windows uniquement | Traiter via Vite/esbuild compatible avant le LOT 10 |
| form-data 4.0.5 | Haute | types Supertest/Superagent | Paquet rattache aux declarations/tests multipart | Mettre a jour les types Supertest/Superagent avant le LOT 10 |
| @babel/core 7.29.0 | Faible | Jest/Istanbul | Instrumentation de couverture uniquement | Mettre a jour Jest/Istanbul/Babel avant le LOT 10 |
| undici 7.25.0 | Haute | `jsdom > undici` | Reseau simule des tests frontend, absent du bundle | Mettre a jour jsdom/undici compatible et relancer les tests frontend avant le LOT 10 |

`pnpm outdated -r` confirme que les corrections potentielles de cet outillage sont pour partie des mises a jour mineures, mais que plusieurs dernieres versions proposees sont majeures (Prisma 7, React 19, Redis 6, Vite 8, ESLint 10 et TypeScript 7). Elles ne sont pas introduites dans ce lot de securisation production. Leur mise a niveau doit etre separee, testee et ne doit pas reposer sur un override transitoire non maitrise.

## LOT 3 - Authentification, proxy et rate limiting

- Date : 2026-07-14
- Statut : termine localement, deploiement de la correction non effectue
- Commit propose : `fix(api): harden authentication and rate limiting`

### Diagnostic confirme

- Le rate limiter lisait directement `X-Forwarded-For` avant l'adresse resolue par
  Express. Un client direct pouvait donc choisir sa cle de limitation.
- Aucun proxy de confiance n'etait configure explicitement.
- Redis etait optionnel et le fallback memoire restait possible en production.
  Plusieurs instances auraient alors applique des compteurs independants.
- `RATE_LIMIT_DISABLED` pouvait court-circuiter le guard dans tous les
  environnements.
- Un access token cryptographiquement valide restait utilisable apres logout,
  desactivation du compte ou changement du mot de passe, jusqu'a son expiration.
- Le validateur de production ne controlait pas Redis, le proxy, issuer/audience
  JWT, le driver de stockage ni les credentials des providers actifs.
- Certains DTO d'authentification acceptaient un `tenantId` sans validation UUID
  coherente et les routes de statut acceptaient un token non borne.
- Express exposait `X-Powered-By` et aucun socle d'en-tetes API n'etait applique.

### Corrections appliquees

- `TRUST_PROXY_HOPS` configure explicitement Express ; valeur locale/test `0`,
  valeur Render `1`. Le rate limiter utilise uniquement `request.ip` resolu par
  Express et ignore les en-tetes transmis directement.
- Redis est obligatoire au demarrage en production. Une panne Redis provoque un
  HTTP 503 sur les routes limitees, sans fallback memoire silencieux. Le fallback
  reste disponible uniquement hors production.
- L'increment Redis et la pose de l'expiration sont atomiques dans un script Lua.
- `RATE_LIMIT_DISABLED=true` est refuse par le validateur et ne desactive jamais
  le guard lorsque le processus a demarre en production.
- Les limites sensibles sont renforcees : login 5/5 min, forgot-password et
  resend-activation 3/15 min, reset/activation/first-connection 5/15 min.
- Chaque access token contient desormais `sid`, identifiant de la session
  `RefreshToken`. Une seule requete SQL par requete protegee verifie utilisateur,
  tenant, statut du compte et session non revoquee/non expiree.
- Logout, logout-all, rotation refresh, changement/reinitialisation de mot de
  passe, desactivation, archivage et suppression revoquent les sessions
  persistantes. La rotation concurrente du meme refresh token est atomique.
- Les erreurs sont distinguees : jeton/session invalide HTTP 401, impossibilite
  de verifier l'etat en base HTTP 503.
- Les tenant IDs des flux login, forgot-password, resend-activation et premiere
  connexion utilisent le validateur commun. Seul le tenant historique exact du
  LOT 1 reste accepte avec son opt-in strict.
- Les query tokens de statut sont bornes entre 32 et 512 caracteres.
- `X-Powered-By` est desactive. L'API ajoute `nosniff`, `DENY`, `no-referrer`, une
  Permissions-Policy restrictive et HSTS en production. Aucune CSP web
  incompatible avec une API JSON n'a ete ajoutee.
- `/health/live` reste independant de Redis ; `/health/ready` verifie PostgreSQL
  et Redis. La preuve fournie par l'operateur montre `database=up` et `redis=up`
  sur Render avant deploiement du code de ce lot.

### Migration, performances et rollback

Aucune migration n'est requise : `RefreshToken.id` est deja un UUID primaire et
devient le `sid`. Les anciens access tokens sans `sid` seront refuses apres le
deploiement ; les utilisateurs devront se reconnecter.

Le controle de session ajoute exactement une requete SQL aux routes protegees.
Sur la base de test jetable, la requete equivalente a mesure 0,069 ms d'execution
et 1,926 ms de planification sur un jeu vide. `users.id` et
`refresh_tokens.id` sont des cles primaires. La latence P95/P99 devra etre
observee en production ; aucun cache n'est ajoute afin de conserver la revocation
immediate.

Rollback applicatif : redeployer ensemble l'ancien emetteur de tokens et l'ancien
guard. Aucune restauration de base n'est necessaire. Les sessions deja revoquees
restent revoquees et les sessions avec UUID explicite restent des lignes valides.

### Configuration Render requise

- `REDIS_URL` : URL privee du Key Value Render, deja configuree par l'operateur ;
- `TRUST_PROXY_HOPS=1` ;
- `RATE_LIMIT_DISABLED=false` ;
- `JWT_ISSUER=gestschool` ;
- `JWT_AUDIENCE=gestschool-clients` ;
- `JWT_SECRET` et `PASSWORD_RESET_SECRET` non factices, au moins 32 caracteres ;
- `FILE_STORAGE_DRIVER=SUPABASE`, `STORAGE_PROVIDER=supabase`, URL et service-role
  Supabase presentes ;
- credentials Brevo presents puisque `OUTBOX_IN_PROCESS_ENABLED=true` active le
  traitement des notifications.

La ressource Redis doit rester dans la meme region que l'API et utiliser
`noeviction`. Sa valeur secrete ne doit jamais etre journalisee ni commitee.

### Validations

| Controle | Resultat |
| --- | --- |
| Tests proxy autorise/non autorise et XFF usurpe | OK |
| Redis disponible simule / indisponible en production / absent en test | OK |
| Desactivation interdite en production, validateur et guard | OK |
| Validateur production complet et configurations dangereuses | OK |
| Tenant historique exact, UUID versionne et UUID invalide | OK |
| Headers HTTP et absence de `X-Powered-By` | OK |
| Rotation refresh concurrente | OK, une reussite et un rejet |
| Compte desactive avec ancien access token | OK, HTTP 401 |
| Logout et logout-all avec ancien access token | OK, HTTP 401 |
| `pnpm --filter @gestschool/api test:unit` | OK, 10 suites et 39 tests |
| `pnpm --filter @gestschool/api lint` | OK |
| `pnpm --filter @gestschool/api build` | OK |
| `pnpm --filter @gestschool/api test:e2e:db:fresh` | OK, 7 suites et 46 tests |
| `git diff --check` | OK avant journalisation finale |

Le premier lancement E2E dans le bac a sable a retourne `Schema engine error` a
cause de l'isolation de PostgreSQL local. La relance autorisee sur la base dediee
`gestschool_test` a applique/verifie les 30 migrations et passe les 46 tests.
Aucun echec n'a ete masque.

### Limites et verdict

- Le schema ne contient pas de table `Tenant` canonique avec un statut actif,
  suspendu ou supprime. Le guard garantit la coherence tenant entre token,
  utilisateur et session, mais ne peut pas controler un etat metier inexistant.
- La disponibilite des routes limitees depend volontairement de Redis en
  production. C'est un fail-closed de securite, avec risque de HTTP 503 pendant
  une panne Redis.
- La mesure SQL locale ne remplace pas une observation de charge production.
- Le code du lot n'est ni committe, ni pousse, ni deploye.

Verdict du LOT 3 : **GO local avec reserve de deploiement**. Les garanties proxy,
rate limiting et revocation sont testees. La validation production finale exige
un deploiement avec les variables ci-dessus puis le controle de `/health/live`,
`/health/ready`, d'un login, d'un logout et d'une desactivation reelle.

## LOT 4 - Stockage et uploads

- Date : 2026-07-14
- Statut : implementation et validation locale terminees, deploiement bloque par les prerequis operateur
- Commit propose : `fix(api): secure storage uploads and document access`

### Diagnostic initial

- `POST /storage/upload-descriptor` autorisait plusieurs buckets et chemins avec la
  permission sans rapport `attendanceAttachment:create`. Le client choisissait le
  type, le dossier et les identifiants de ressource.
- Les providers `S3` et `WEBHOOK` retournaient des URI de succes sans enregistrer
  aucun octet. Le descriptor signe permettait aussi de contourner la validation du
  contenu par l'API.
- Les avatars validaient surtout le MIME multipart et une signature partielle. Les
  documents enseignants et justificatifs acceptaient une URL fournie par le client.
- Les pieces scolaires sensibles pouvaient donc ne pas etre reliees de maniere
  verifiable a une ressource et a un tenant. Le remplacement/suppression ne
  garantissait pas la coherence entre PostgreSQL et le stockage.

### Matrice cible verifiee

| Fichier | Ressource | Roles | Permissions | Limite et formats | Visibilite | Stockage |
| --- | --- | --- | --- | --- | --- | --- |
| Avatar | utilisateur courant | tous les roles authentifies, soi-meme uniquement | `avatar:create/delete` | 2 Mo, JPEG/PNG/WebP, 4096 px et 16 MP max | privee, URL signee 60-900 s via profil authentifie | LOCAL hors production ou Supabase |
| Piece enseignant | enseignant du tenant | ADMIN, SCOLARITE | `teacherDocument:create/read/update/delete` | 10 Mo, JPEG/PNG/WebP/PDF/DOCX/XLSX | privee, endpoint authentifie | bucket documents |
| Justificatif absence | absence du tenant | ADMIN, SCOLARITE | `attendanceAttachment:create/read/delete` | 5 Mo, JPEG/PNG/WebP/PDF | privee, endpoint authentifie | bucket documents |
| Piece eleve | eleve | aucun flux binaire implemente | non disponible | non defini | privee cible | decision metier requise |
| Piece parent | parent | aucun flux binaire implemente | non disponible | non defini | privee cible | decision metier requise |
| Recu | paiement | generation metier existante, pas d'upload | non disponible pour upload | non defini | privee cible | decision metier requise |
| Facture | facture | aucun upload de fichier | non disponible | non defini | privee cible | decision metier requise |
| Bulletin | bulletin | generation/donnees existantes, pas d'upload | non disponible pour upload | non defini | privee cible | decision metier requise |
| Rapport | rapport | aucun upload de fichier | non disponible | non defini | privee cible | decision metier requise |
| Document administratif | ressource a definir | aucun flux binaire implemente | non disponible | non defini | privee cible | decision d'architecture requise |

### Corrections appliquees

- Suppression du controller/DTO generique et migration du frontend vers trois routes
  multipart metier. Les identifiants parents sont parses en UUID puis verifies par
  requete `tenantId + ressource` avant tout stockage.
- Permissions dediees `avatar`, `teacherDocument` et `attendanceAttachment`, avec
  operations explicites. Les cles sont generees par le serveur sous
  `tenants/{tenantId}/.../{uuid}.{extension}` ; aucun nom client ne devient un chemin.
- Validation combinee de la taille, extension, MIME declare, signature, parsing et
  decodage reel. Sharp decode les images ; pdf-lib parse les PDF et les fonctions
  actives sont refusees ; JSZip controle CRC, chemins, macros, contenus actifs et
  expansion des archives Office. Les fichiers vides, tronques, animes, polyglottes
  avec suffixe et incoherents sont rejetes.
- LOCAL utilise une ecriture temporaire atomique en mode `0600`, controle le chemin,
  nettoie le temporaire et reste interdit en production. Supabase stocke les
  documents et avatars dans des buckets prives. Les documents passent par une route
  autorisee ; les avatars sont livres par URL signee courte, generee par l'API. Les
  reponses documentaires imposent `nosniff`, `private, no-store` et un
  `Content-Disposition` sur. La service-role ne quitte jamais le backend.
- `S3` et `WEBHOOK` ne sont plus des drivers utilisables : le demarrage echoue
  explicitement s'ils sont selectionnes. Aucun nouveau fournisseur cloud n'a ete
  implemente.
- La migration transactionnelle `20260714130000_secure_storage_metadata` ajoute les
  references driver/bucket/key, MIME/taille avatar, contraintes de taille et index
  uniques tenant/objet. Aucune ancienne migration n'a ete modifiee.
- Creation : le fichier est supprime si la transaction DB echoue. Remplacement et
  suppression restaurent les metadonnees DB si la suppression provider echoue.
  Le remplacement d'avatar utilise un verrou optimiste sur l'etat utilisateur : un
  upload concurrent perdant est refuse et son nouvel objet est nettoye.
  Toutes les operations produisent un audit ; un echec de rollback est journalise
  explicitement et n'est jamais masque.

### Validations et limites

| Controle | Resultat |
| --- | --- |
| Prisma generate et `prisma validate` | OK, schema valide |
| Lint et build API | OK |
| Tests unitaires API | OK, 12 suites et 59 tests |
| Tests LOT 4 validation/stockage | OK, 3 suites et 21 tests : MIME, signature, corruption, dimensions, chemins, polyglottes, providers, concurrence et temporaires |
| Typage/lint des trois E2E modifies | OK |
| E2E PostgreSQL et migration reelle | OK : PostgreSQL 16 jetable, 31/31 migrations, 7 suites et 46/46 tests |
| Lint/tests/build/smoke frontend | OK, 15 fichiers et 64 tests |
| Audit production | OK avec pnpm 11.13.0 : aucune vulnerabilite connue ; lockfile inchange |
| Gate CI audit | OK : version 11.x verifiee avant audit, niveaux high/critical bloquants, installation projet conservee en pnpm 10.24.0 |
| `git diff --check` | OK |

Une premiere execution parallele des suites API et frontend a depasse le delai de
5 secondes sur un test Office et un test de flux frontend, sans echec d'assertion.
Sans modifier les delais ni les tests, les relances isolees ont passe : storage
21/21, unite API 59/59 et frontend 64/64. Aucun echec n'a ete masque.

Les lignes historiques de documents enseignants/justificatifs sans
`storage_driver/bucket/key` ne sont plus telechargeables et doivent etre inventoriees
puis backfillees ou archivees avant de retirer leur ancien stockage. Aucun antivirus
ni Content Disarm and Reconstruction n'est ajoute : les parseurs reduisent le risque,
mais une analyse malware asynchrone reste necessaire pour des documents provenant de
publics non fiables. Les rollbacks sont compensatoires ; un double echec provider/DB
est journalise mais il n'existe pas encore de file de reconciliation des orphelins.

Rollback : redeployer d'abord l'ancienne application. Les colonnes additives peuvent
rester sans impact. Leur suppression eventuelle exige une sauvegarde, un audit des
objets et une migration ulterieure ; ne jamais annuler cette migration en supprimant
les colonnes avant le rollback applicatif.

Le gate CI utilise ponctuellement pnpm 11.13.0 avec
`--pm-on-fail=ignore` uniquement pour accepter la difference volontaire avec le
`packageManager` 10.24.0 du projet. La version affichee doit commencer par `11.`
avant l'audit. L'installation, les builds et le lockfile restent geres par pnpm
10.24.0 ; l'empreinte du lockfile est controlee avant/apres l'audit local.

Le plan idempotent d'inventaire, dry-run, migration, reprise, reconciliation et
rollback des avatars, documents enseignants et justificatifs historiques est
documente dans `docs/runbooks/storage.md`. Aucune migration de fichiers n'a ete
executee pendant ce lot.

Configuration operateur : conserver `STORAGE_PROVIDER=supabase`,
`FILE_STORAGE_DRIVER=SUPABASE`, deux buckets distincts et prives
`gestschool-documents` et `gestschool-avatars`, la service-role uniquement cote API,
`SUPABASE_STORAGE_AVATARS_PUBLIC=false` et une duree d'URL signee courte (300 s par
defaut, 60-900 s autorises).

Verdict LOT 4 : **GO pour commit, NO-GO deploiement** tant que les buckets prives et
secrets Render ne sont pas verifies, PostgreSQL n'est pas sauvegarde avec un test de
restauration, la migration n'est pas testee sur une copie representative et les
anciens fichiers ne sont pas inventories.

## LOT 5 - Notifications, outbox et livraisons fournisseurs

- Date : 2026-07-16
- Statut : implementation et validations locales terminees
- Commit propose : `fix(api): harden notification delivery and outbox processing`

### Diagnostic initial

- La deduplication reposait sur des cles fournies ou construites de maniere
  heterogene. La base ne garantissait pas l'unicite metier d'une livraison par
  tenant et les relances concurrentes pouvaient creer plusieurs notifications.
- Les workers utilisaient un statut de traitement, mais sans lease token de fencing.
  Un worker ralenti ou relance apres expiration pouvait donc ecraser le resultat du
  worker ayant repris le travail.
- Les appels fournisseurs et les mises a jour PostgreSQL ne peuvent pas etre rendus
  atomiques. Un timeout ou un crash apres acceptation fournisseur laissait un
  resultat inconnu sans modele explicite ni conservation systematique de la meme cle
  d'idempotence.
- Les statuts historiques `PENDING`, `SCHEDULED`, `SENT` et `FAILED` ne distinguaient
  pas un echec temporaire, permanent, une dead-letter, une annulation ou une
  livraison confirmee par callback.
- Les callbacks ne disposaient pas d'une contrainte evenement fournisseur, d'une
  fenetre anti-rejeu et d'une transaction englobant deduplication et changement de
  statut. Les retries outbox utilisaient un delai fixe.

### Flux cible et garantie reelle

Le flux devient : evenement metier durable avec `dedupeKey` -> reservation outbox
atomique -> creation idempotente de notification -> reservation notification par
lease -> appel fournisseur hors transaction SQL -> finalisation fencee par
`workerId + leaseToken` -> callback signe et deduplique -> statut final.

La garantie obtenue est **au moins une fois avec deduplication locale**. La cle
metier couvre tenant, evenement, ressource, destinataire normalise, canal et version
de template. La contrainte PostgreSQL `(tenant_id, idempotency_key)` empeche deux
livraisons locales identiques. La meme cle est envoyee au fournisseur, mais
l'absence de doublon externe depend de la prise en charge effective de cette cle par
le fournisseur. Un timeout au resultat inconnu reste relancable avec la meme cle ;
aucune promesse `exactly once` n'est faite.

### Etats et transitions

| Etat | Signification | Transitions autorisees principales |
| --- | --- | --- |
| `PENDING` | livraison creee, prete ou planifiee | `PROCESSING`, `CANCELLED` |
| `PROCESSING` | lease exclusive en cours | `SENT`, `FAILED_RETRYABLE`, `FAILED_PERMANENT`, `DEAD_LETTER` |
| `SENT` | fournisseur a accepte la livraison | `DELIVERED`, `FAILED_PERMANENT` par callback |
| `DELIVERED` | fournisseur a confirme la livraison | terminal |
| `FAILED_RETRYABLE` | echec temporaire ou resultat inconnu | `PROCESSING`, `CANCELLED` |
| `FAILED_PERMANENT` | refus non relancable automatiquement | replay manuel audite vers `PENDING` |
| `DEAD_LETTER` | maximum de tentatives ou leases expirees atteint | replay manuel audite vers `PENDING` |
| `CANCELLED` | annulation explicite avant livraison finale | terminal |

Les callbacks sont appliques dans une transaction avec verrou de ligne. Une cle
unique `(tenant_id, provider, provider_event_id)` rend un callback rejoue ou recu en
concurrence sans effet supplementaire. La signature HMAC lie timestamp, tenant,
provider, identifiant fournisseur, statut et evenement ; la fenetre anti-rejeu est
configurable.

### Lease, retry et dead-letter

- Chaque reservation ecrit un worker unique, un `leaseToken` UUID et une expiration.
  La selection et la prise de lease sont atomiques ; l'appel reseau se fait ensuite
  sans verrou SQL. La finalisation exige toujours le meme worker et le meme token.
  Le compteur de tentatives outbox est incremente au moment de la reservation, pas
  a la finalisation : des crashes repetes apres la prise de lease atteignent donc la
  dead-letter au lieu de pouvoir boucler indefiniment.
- Une lease expiree est recuperee. L'ancienne execution est fencee et ne peut plus
  finaliser la ligne. Apres le maximum de tentatives, la notification ou l'evenement
  passe en dead-letter.
- HTTP 400 est permanent ; HTTP 429, HTTP 5xx et les erreurs reseau/timeout sont
  relancables. `Retry-After` est respecte. Sinon, un backoff exponentiel avec jitter
  borne et plafond est applique. Un timeout est marque `outcome_unknown`.
- Les erreurs persistees et journalisees sont nettoyees et tronquees. Les contenus,
  destinataires, secrets et payloads fournisseurs ne sont pas ecrits dans les logs.
- Le replay manuel est reserve aux notifications permanentes/dead-letter et cree un
  evenement d'audit IAM avec l'auteur et la raison.

### Migration et rollback

La nouvelle migration transactionnelle
`20260716113000_notification_delivery_reliability` ajoute les etats, leases,
tentatives, resultat inconnu, replay, identifiants callback et contraintes. Elle
echoue avant toute ecriture si des doublons historiques `(tenant_id,
idempotency_key)` existent. Les cles historiques absentes sont backfillees avec une
cle unique derivee de l'identifiant de notification. Aucune ancienne migration n'a
ete modifiee.

Rollback applicatif : redeployer d'abord la version precedente. Les colonnes
additives peuvent rester. Un rollback SQL ulterieur doit supprimer les nouvelles
contraintes/index avant les colonnes, uniquement apres sauvegarde et verification
qu'aucun statut nouveau n'est requis par l'application precedente. Ne pas executer
ce rollback pendant qu'un worker LOT 5 est actif.

### Tests, limites et configuration

Les tests couvrent deux workers concurrents, duplication de cle, crash avant envoi,
resultat inconnu apres envoi, lease expiree, dead-letter, replay audite, HTTP 400/429/
500, timeout, `Retry-After`, callback valide/invalide/perime/rejoue/concurrent et
isolation inter-tenant. Les appels fournisseurs sont simules ; aucun email ou SMS
reel n'est emis.

Les liens d'activation et de reinitialisation restent envoyes synchroniquement par
le service d'authentification, avec une cle d'idempotence fournisseur. Les placer
dans l'outbox exigerait de definir le chiffrement, la duree de conservation et la
gestion de secrets a usage unique dans les payloads durables. Cette decision est
hors LOT 5.

Le header `Idempotency-Key` est transmis a Brevo, mais sa garantie effective doit
etre confirmee dans le contrat fournisseur. Le callback entrant implemente un
contrat HMAC generique GestSchool ; l'adaptateur de signature et d'evenements propre
a un fournisseur reel doit etre valide avant activation. En production, activer un
provider uniquement apres avoir configure ses secrets et son webhook signe.

La configuration Render versionnee reste volontairement inactive :
`NOTIFICATIONS_WORKER_ENABLED=false`, `OUTBOX_IN_PROCESS_ENABLED=false`, providers
email/SMS `mock`, `BREVO_SMS_DRY_RUN=true` et `ALLOW_REAL_SMS=false`. L'activation
requiert une action explicite et coordonnee : secrets valides, provider choisi,
webhook HTTPS teste en recette, puis activation du worker ou du processeur outbox.
Une cle Brevo presente seule ne declenche donc aucun envoi.

| Controle final | Resultat |
| --- | --- |
| Installation figee | OK avec pnpm 10.24.0, lockfile a jour |
| Prisma validate/generate | OK avec Prisma 6.19.3 |
| Lint et build API | OK |
| Tests unitaires API | OK, 17 suites et 87 tests |
| Migration PostgreSQL | OK, base jetable PostgreSQL 16, 32/32 migrations, schema a jour |
| E2E PostgreSQL | OK, 8 suites et 54/54 tests, dont la dead-letter apres crashes outbox repetes |
| Tests frontend | OK, lint, 15 fichiers et 64/64 tests, build et smoke |
| Audit production | OK avec pnpm 11.13.0, aucune vulnerabilite connue, lockfile inchange |
| `git diff --check` | OK |

La commande `corepack` de la machine locale pointe vers une installation Windows
WSL invalide. Le controle local a donc telecharge pnpm 11.13.0 dans le cache isole de
`pnpm dlx`, a affiche explicitement `11.13.0`, puis a execute l'audit. La CI Linux
continue d'utiliser `corepack pnpm@11.13.0` et verifie explicitement le prefixe
`11.` avant l'audit. Ce contournement local n'a modifie ni le manifeste ni le
lockfile.

Verdict LOT 5 : **GO pour commit**. L'activation d'un fournisseur reel reste
**NO-GO** tant que l'idempotence effective du fournisseur, son contrat de callback,
les secrets Render, l'URL webhook HTTPS et un test en environnement de recette ne
sont pas verifies. Aucun appel reel fournisseur n'a ete effectue pendant ce lot.

## LOT 6 - Integrite PostgreSQL et creations concurrentes (2026-07-16)

### Diagnostic initial

L'audit a croise le schema Prisma, les 32 migrations alors presentes, le catalogue
PostgreSQL 16 local et les services qui effectuent des controles d'unicite avant
creation. Plusieurs invariants metier reposaient sur une verification applicative
suivie d'une insertion. Deux requetes concurrentes pouvaient donc toutes les deux
passer la verification. En outre, une contrainte `UNIQUE` PostgreSQL ordinaire ne
considere pas deux valeurs `NULL` comme egales.

| Modele/table | Colonnes et nullabilite | Protection avant LOT 6 | Course possible | Protection retenue |
| --- | --- | --- | --- | --- |
| `TeacherSkill` | tenant, enseignant, matiere, cursus, `cycleId?`, `levelId?` | unique ordinaire | deux competences de meme portee avec un ou deux `NULL` | `UNIQUE NULLS NOT DISTINCT` |
| `TeacherAssignment` | tenant, annee, classe, cursus; homeroom et statut | controle applicatif | deux professeurs principaux actifs pour la meme classe | index unique partiel sur les lignes actives homeroom |
| `RoomAssignment` | tenant, salle, annee et sept portees nullables | unique ordinaire | deux affectations identiques avec une portee `NULL` | `UNIQUE NULLS NOT DISTINCT` |
| `RoomAvailability` | tenant, salle, annee, `periodId?`, jour, heures, type | aucun unique | deux disponibilites identiques | `UNIQUE NULLS NOT DISTINCT` |
| `ParentStudentLink` | tenant, `parentId?`, `parentUserId?`, eleve, archivage | unique legacy sur utilisateur/relation | relation active dupliquee ou deux contacts principaux | trois index uniques partiels actifs |
| `TrackPlacement` | tenant, eleve, annee, classe, cursus, type; non null | unique SQL existant | conflit d'upsert renvoye en 500 | contrainte conservee, `P2002` converti en 409 |
| `Enrollment` | tenant, eleve, annee, classe, cursus; non null | unique SQL existant | insertion concurrente | aucune migration, protection deja finale en base |
| `Payment` | tenant, methode, `referenceExternal?` | aucun unique sur la reference | deux callbacks creent deux paiements | index unique partiel et verrou de tentative |
| `PaymentProviderAttempt` | fournisseur, `providerToken?` | unique tenant/fournisseur/token | callback public ambigu entre deux tenants | index unique global partiel par fournisseur/token |
| Notifications/outbox | tenant et cles d'idempotence | contraintes LOT 5 | duplication de livraison locale | aucune modification LOT 6 |

Le jeton fournisseur de paiement est volontairement une exception a l'unicite
tenantée : le callback public ne recoit pas de `tenant_id` et recherche exactement
`(provider, provider_token)`. La contrainte globale correspond donc au contrat de
recherche et evite une resolution inter-tenant ambigue.

### Inventaire des uniques contenant des colonnes nullables

Le catalogue apres migration expose 23 index/contraintes uniques comportant au
moins une colonne nullable. Ils sont classes ainsi :

- semantique `NULL` renforcee par LOT 6 : competences enseignants, affectations de
  salles et disponibilites de salles ;
- index partiels LOT 6 : liens parent/eleve actifs par profil ou utilisateur,
  contact principal, reference externe de paiement et jeton fournisseur ;
- identifiants optionnels volontairement uniques seulement lorsqu'ils existent :
  email ou compte rattache d'un eleve/enseignant, evenement fournisseur,
  `requestId`, `dedupeKey`, reference de don et liens d'inscription legacy ;
- chemins de stockage optionnels : avatar, document enseignant et justificatif ;
  les services imposent le couple bucket/cle et les index ne s'appliquent que
  lorsque ces metadonnees existent ;
- cles canoniques de notes, presences et bulletins : la cle nullable de placement
  coexiste avec une cle legacy non nullable qui protege le fallback metier.

Aucune autre contrainte nullable n'a ete transformee : rendre tous les `NULL`
equivalents aurait interdit des comptes non rattaches ou des identifiants externes
encore inconnus, ce qui ne correspond pas au metier.

### Controle des donnees et migrations

Les recherches prealables sur la base locale peuplee ont trouve zero doublon pour
les neuf groupes cibles : competences, professeurs principaux actifs, affectations
et disponibilites de salles, relations parent/eleve par profil ou utilisateur,
contacts principaux, references externes de paiement et jetons fournisseur. Aucun
lien sans identite parent n'a ete trouve. Les controles de onze relations tenantées
avant migration, puis les controles parents, enseignants, salles et paiements apres
migration, ont trouve zero incoherence inter-tenant ou referentielle.

Deux nouvelles migrations transactionnelles ont ete creees, sans modifier les
anciennes migrations :

- `20260716160000_nullable_unique_concurrency_hardening` ajoute les contraintes
  null-safe et les index partiels metier ;
- `20260716170000_payment_provider_token_scope` aligne l'unicite du jeton externe
  sur le lookup public du callback.

Chaque migration commence par une verification des collisions et leve une erreur
explicite avant toute modification. Une base PostgreSQL 16 jetable a ete recreee :
34 migrations sur 34 ont ete appliquees et `prisma migrate status` confirme un
schema a jour. La base locale peuplee a ete sauvegardee dans `/tmp`, puis migree
avec succes. Aucune migration de production n'a ete executee et aucune donnee n'a
ete fusionnee, supprimee ou corrigee automatiquement.

### Gestion applicative et concurrence

Les services conservent les controles applicatifs pour produire un message utile,
mais PostgreSQL est desormais la protection finale. Les violations `P2002` sont
converties en `409 Conflict` pour les placements de cursus, relations parent/eleve,
affectations et disponibilites de salles et paiements. Les messages ne publient ni
nom de contrainte ni detail de donnees concurrentes.

Le callback PayDunya verrouille atomiquement la tentative avec `FOR UPDATE`, relit
son etat puis cree le paiement dans la meme transaction. Le verrou est pris apres
la verification fournisseur : aucun appel reseau n'est effectue sous verrou. Un
callback concurrent reutilise le paiement deja rattache et ne cree pas de doublon.

Les tests PostgreSQL lancent deux operations paralleles avec garde anti-deadlock et
couvrent : competence nullable, affectation enseignant identique, deux professeurs
principaux, affectation et disponibilite de salle nullables, deux mises a jour qui
convergent, relation parent/eleve, memes donnees dans deux tenants et deux callbacks
de paiement. Les courses renvoient `[201, 409]` ou `[200, 409]` selon l'operation,
laissent une seule ligne et ne provoquent aucun blocage durable. Le callback
idempotent renvoie deux succes vers le meme paiement et ne laisse qu'un paiement.

### Index, performances et rollback

Le catalogue confirme neuf protections LOT 6. Les trois contraintes null-safe ont
`indnullsnotdistinct=true` et les six index partiels ont les predicats attendus.
Les `EXPLAIN` montrent l'utilisation des index partiels pour le professeur
principal, le lien parent actif, la reference externe et le jeton fournisseur.
Pour les recherches de competences et de salles, les index tenantés plus etroits
existants restent de meilleurs chemins de lecture ; ils ne sont donc pas
strictement redondants et n'ont pas ete supprimes.

Le cout d'ecriture augmente d'un controle unique pour les disponibilites et les
invariants partiels. Les uniques de competences et d'affectations remplacent leurs
anciens index au lieu de les dupliquer. Ce cout est borne et justifie par la
suppression des doublons concurrentiels.

Rollback documente : arreter les ecritures, sauvegarder PostgreSQL et redeployer
d'abord l'application precedente. Verifier ensuite qu'aucune ligne acceptee par les
nouveaux index ne violerait les anciennes contraintes, notamment les liens archives.
Dans une transaction, supprimer les index partiels, recreer les uniques ordinaires
de competences/affectations et l'ancien index de jeton tenanté, puis retirer le
nouvel unique des disponibilites. Ne jamais executer ce rollback sans ce preflight :
une collision doit interrompre le rollback, jamais provoquer une suppression.

### Validations et actions avant production

| Controle | Resultat |
| --- | --- |
| Prisma validate/generate | OK, Prisma 6.19.3 |
| PostgreSQL 16 vierge | OK, 34/34 migrations |
| Base locale peuplee | OK apres sauvegarde, schema a jour |
| Tests unitaires API | OK, 17 suites et 87 tests |
| Tests concurrence cibles | OK, 2 suites et 18 tests |
| E2E PostgreSQL complet | OK, 9 suites et 61 tests |
| Typecheck, lint et build API | OK |
| Audit production pnpm 11 | OK, pnpm 11.13.0, aucune vulnerabilite connue |
| `git diff --check` | OK |

Avant toute production, l'utilisateur doit : faire une sauvegarde verifiee,
executer les requetes de preflight en lecture seule sur une copie recente, tester
les deux migrations sur cette copie, controler les volumes et temps de creation
d'index, puis planifier une fenetre sans ecritures concurrentes. Si un seul doublon
est trouve, la migration doit rester bloquee jusqu'a une decision metier explicite.

Verdict LOT 6 : **GO** pour revue et commit. Le deploiement des migrations reste
**NO-GO** avant sauvegarde, preflight sur une copie recente et repetition de la
migration sur cette copie. Aucune migration de production, aucun commit et aucun
push n'ont ete effectues.

## LOT 7 - Audit visuel et smoke frontend stricts (2026-07-18)

### Diagnostic initial

Le runner central d'audit visuel supprimait explicitement les erreurs console et
HTTP locales contenant `/api/v1`, classait les erreurs reseau en severite non
bloquante et ne faisait echouer la commande que sur les constats les plus graves.
Il utilisait le compte d'apercu developpement, sans contrat formel entre audit
mocke et audit integre. Un audit pouvait donc etre vert avec une API indisponible.

Quatorze scripts visuels historiques totalisent plus de 5 300 lignes. Ils utilisent
des attentes arbitraires et des politiques de severite heterogenes. Le smoke
`Frontend/web-admin/scripts/smoke-tests.mjs` est un controle statique utile, mais il
n'ouvre pas un navigateur et ne detecte ni erreur API ni regression de layout.

### Correction

- Deux modes exclusifs : `mocked` et `integrated`. L'absence de mode est refusee.
- Fixtures API versionnees et routes methode/chemin exactes. Aucune interception
  generique `/api/v1/**`.
- Collecteur bloquant pour API 4xx/5xx, requete non mockee, `requestfailed`, erreur
  console, `pageerror`, page vide, loading bloque, indisponibilite inattendue,
  overflow horizontal, selecteur critique absent et action primaire hors ecran.
- Matrice responsive mobile, tablette, desktop, large desktop et zoom 200%, avec
  themes clair/sombre et langues FR/EN/AR/RTL sur les ecrans critiques.
- Captures deterministes, fuseau Europe/Paris, polices attendues, animations et
  caret desactives, sans delai arbitraire dans le runner central.
- Rapport JSON exploitable et traces Playwright sur chaque workflow en echec.
- Allowlist stricte avec type, route, motif, raison, echeance et ticket. Elle reste
  vide pendant ce lot.
- CI branchee sur le mode mocked reduit et conservation des preuves pendant 14
  jours, meme en cas d'echec.

Le runbook complet et l'inventaire des scripts se trouvent dans
`docs/runbooks/visual-audit.md`.

### Preuves du mecanisme

Les tests du collecteur prouvent le blocage d'une API 500, d'une route API non
mockee, d'une erreur console, d'un `pageerror`, d'un loading bloque, d'un overflow
et d'un selecteur critique absent. Ils verifient aussi qu'une allowlist precise ne
masque pas une autre erreur et qu'une exception expiree est refusee.

### Resultats des audits

| Controle | Resultat |
| --- | --- |
| Lint des scripts LOT 7 | OK |
| Tests du collecteur | OK, 6/6 |
| Audit mocked complet | ROUGE, 121 workflows, 117 succes, 4 echecs, 14 constats |
| Audit mocked CI final | ROUGE attendu, 61 workflows, 61 captures, 14 constats |
| Requetes mocked | 66 requetes servies par des routes exactes, aucune route inattendue |
| Audit integrated | OK, 15 workflows et 15 captures, 0 constat |
| Infrastructure integrated | PostgreSQL 16 dedie, 34 migrations, seed minimal ; Redis 7 ephemere |
| Lint frontend | OK |
| Tests frontend | OK, 15 fichiers et 64 tests |
| Build frontend | OK |
| Smoke frontend | OK |
| `git diff --check` | OK |

Les quatre variantes rouges sont factuelles et ne sont pas allowlistees :

- Tableau de bord EN et AR : cinq contenus critiques restent en francais
  (`Bienvenue, voici`, `Recouvrement & encaissements`, `Suivi operationnel`,
  `Lecture rapide issue`, `Indicateurs cles`).
- Inscriptions EN et AR : le titre `Liste des inscriptions` reste en francais et
  les titres attendus `Enrollment list` / `قائمة التسجيلات` sont absents.

Aucune erreur API, console, `pageerror`, loading bloque, overflow, action hors
ecran ou route non mockee n'a ete detectee dans l'audit complet. Le mode integrated
a utilise une base isolee et un compte `example/test`, sans donnee client ni
interception metier.

La matrice CI finale confirme que le gate echoue uniquement sur ces quatorze
constats i18n : aucune requete API inattendue et aucune allowlist n'ont ete
enregistrees. Les captures et traces restent hors Git et seront publiees comme
artefact CI pendant quatorze jours.

### Risques et verdict

Le gate LOT 7 est maintenant strict et reproductible : **GO technique pour le
mecanisme d'audit**. La CI visuelle et le LOT 7 global restent **NO-GO** tant que les
deux dettes i18n ci-dessus ne sont pas corrigees. Les scripts historiques ne sont
plus une preuve de release et devront etre migres ou supprimes pendant le decoupage
frontend, sans melanger cette dette au LOT 7.

Message de commit propose :
`test(web-admin): make visual audits strict and deterministic`.

## LOT 7A - Correction des anomalies i18n du gate visuel (2026-07-18)

### Diagnostic des 14 constats

| # | Route | Langue | Constat avant correction | Traduction attendue | Source |
| --- | --- | --- | --- | --- | --- |
| 1 | `/app/dashboard` | EN | `Bienvenue, voici` visible | `Welcome. Here is today's operational overview of the school.` | Chaine directe dans `dashboard-screen.tsx` |
| 2 | `/app/dashboard` | EN | `Recouvrement & encaissements` visible | `Collections & payments` | Chaine directe dans `dashboard-screen.tsx` |
| 3 | `/app/dashboard` | EN | `Lecture rapide issue` visible | `Quick overview based on available invoices.` | Chaine directe dans `dashboard-screen.tsx` |
| 4 | `/app/dashboard` | EN | `Suivi operationnel` visible | `Operational monitoring` | Chaine directe dans `dashboard-screen.tsx` |
| 5 | `/app/dashboard` | EN | `Indicateurs cles` visible | `Key indicators for the visible scope.` | Chaine directe dans `dashboard-screen.tsx` |
| 6 | `/app/dashboard` | AR | `Bienvenue, voici` visible | `مرحبًا، إليك النظرة التشغيلية للمؤسسة التعليمية اليوم.` | Chaine directe dans `dashboard-screen.tsx` |
| 7 | `/app/dashboard` | AR | `Recouvrement & encaissements` visible | `التحصيل والمدفوعات` | Chaine directe dans `dashboard-screen.tsx` |
| 8 | `/app/dashboard` | AR | `Lecture rapide issue` visible | `نظرة سريعة استنادًا إلى الفواتير المتاحة.` | Chaine directe dans `dashboard-screen.tsx` |
| 9 | `/app/dashboard` | AR | `Suivi operationnel` visible | `المتابعة التشغيلية` | Chaine directe dans `dashboard-screen.tsx` |
| 10 | `/app/dashboard` | AR | `Indicateurs cles` visible | `المؤشرات الرئيسية للنطاق المعروض.` | Chaine directe dans `dashboard-screen.tsx` |
| 11 | `/app/enrollments` | EN | Titre `Enrollment list` absent | `Enrollment list` | Titre dynamique dans `enrollments-screen.tsx` |
| 12 | `/app/enrollments` | EN | `Liste des inscriptions` visible | Aucun titre francais visible | Titre dynamique dans `enrollments-screen.tsx` |
| 13 | `/app/enrollments` | AR | Titre `قائمة التسجيلات` absent | `قائمة التسجيلات` | Titre dynamique dans `enrollments-screen.tsx` |
| 14 | `/app/enrollments` | AR | `Liste des inscriptions` visible | Aucun titre francais visible | Titre dynamique dans `enrollments-screen.tsx` |

Les cinq textes du dashboard contournaient le systeme i18n parce qu'ils etaient
rendus directement par le composant. Le titre des inscriptions concatenaient le
compteur avant le passage du traducteur DOM : `Liste des inscriptions (3)` ne
correspondait donc jamais a la cle exacte `Liste des inscriptions`. Aucun constat
ne provenait de l'API, d'une donnee metier ou d'une fixture d'audit.

### Correction et tests

Les six cles d'interface ont ete centralisees dans `shared/i18n.ts`, avec une
traduction anglaise et une traduction arabe naturelle. Les deux ecrans traduisent
desormais la cle avant de rendre le texte dynamique. `App.tsx` transmet la langue
active au dashboard. Le francais reste la valeur par defaut et l'arabe conserve
la direction `rtl` fournie par les metadonnees i18n existantes. Aucune traduction
n'a ete dupliquee dans les composants et aucune donnee metier n'a ete modifiee.

Les tests ciblent le dashboard et les inscriptions en FR, EN et AR, chaque cle
ajoutee, l'absence des anciens titres francais en EN/AR et la direction RTL. Le
collecteur, les fixtures, les regles d'echec et l'allowlist n'ont pas ete modifies.

| Controle | Resultat |
| --- | --- |
| Tests i18n et parcours critiques cibles | OK, 2 fichiers et 23 tests |
| Tests frontend complets | OK, 31 suites et 70 tests |
| Lint frontend | OK |
| Build frontend | OK |
| Smoke frontend | OK |
| Audit mocked complet | OK, 121/121 workflows, 0 constat |
| Audit mocked CI | OK, 61/61 workflows, 0 constat |
| Erreurs API/console/pageerror/loading/overflow | 0 dans les deux rapports |
| Allowlist | Vide |
| Audit integrated | Non relance : PostgreSQL, Redis et API locale indisponibles pendant cette passe |
| `git diff --check` | OK avant documentation finale |

Verdict LOT 7A : **GO** pour revue. Les quatorze constats sont corriges sans
exception, sans allowlist et sans modification du mecanisme d'audit. Le mode
integre pourra etre relance des qu'un environnement PostgreSQL/Redis/API isole est
disponible ; cette limite ne remet pas en cause les deux gates mocked valides.

Message de commit propose :
`fix(web-admin): translate dashboard and enrollment audit labels`.
