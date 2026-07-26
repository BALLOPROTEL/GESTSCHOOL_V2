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

## LOT 1B - Audit du snapshot et migration canonique du tenant

- Date : 2026-07-26
- Source : copie locale recente de production, exposee uniquement par `PROD_SNAPSHOT_DATABASE_URL`
- Statut : audit et strategie testes ; aucune migration active ajoutee et aucune donnee de production modifiee

### Garde-fous et scenario

La connexion du snapshot a confirme `transaction_read_only=on`. Toutes les lectures ont utilise exclusivement `PROD_SNAPSHOT_DATABASE_URL`. Aucun acces direct a Supabase ou a la production, aucune ecriture sur le snapshot et aucune sortie nominative n'ont ete effectues.

Les scenarios sont interpretes ainsi :

- A : tenant historique absent des donnees reelles ;
- B : tenant historique limite aux seeds ou tests ;
- C : tenant historique utilise par une base existante, cible canonique absente et migration transactionnelle possible ;
- D : donnees reelles non verifiables ;
- E : coexistence historique/canonique, tenants inattendus, collisions ou anomalies d'integrite imposant une decision de donnees.

Le snapshot releve du **scenario C**. Il contient uniquement le tenant historique `00000000-0000-0000-0000-000000000001`. L'UUID canonique cible `00000000-0000-4000-8000-000000000001` est absent. Aucun element du scenario E n'a ete detecte dans les colonnes tenant.

### Inventaire factuel

- PostgreSQL 17.10, environ 11,9 Mo.
- 42 tables portent `tenant_id`, toutes de type PostgreSQL `uuid`.
- 41 colonnes sont obligatoires ; seule `outbox_events.tenant_id` est nullable.
- 758 lignes historiques, reparties dans 18 tables ; 24 tables tenant sont vides.
- Une seule valeur distincte de `tenant_id` sur l'ensemble des 42 tables.
- 0 ligne canonique cible et 0 `tenant_id` NULL.
- Une valeur UUID syntaxiquement invalide est impossible dans une colonne PostgreSQL `uuid`. Les 758 valeurs ont cependant une version UUID non canonique, correspondant exactement a l'identifiant historique autorise temporairement.
- 33 contraintes uniques tenant, 107 index tenant et 86 relations parent/enfant entre tables tenant.
- 0 cle etrangere orpheline, 0 relation inter-tenant et 0 contrainte PostgreSQL non validee.
- `parent_student_links` et `parents` sont vides dans ce snapshot. Leur integrite technique est correcte, mais le domaine parent/eleve n'est pas representatif fonctionnellement.
- Aucune table proprietaire `tenants` ou `establishments` et aucune FK centrale sur `tenant_id`.
- 43 politiques RLS publiques utilisent la meme restriction de roles serveur ; aucune ne contient l'identifiant historique.

Repartition des 758 lignes historiques :

| Table | Lignes |
| --- | ---: |
| `academic_periods` | 1 |
| `classes` | 1 |
| `cycles` | 1 |
| `grades` | 1 |
| `iam_audit_logs` | 267 |
| `levels` | 1 |
| `outbox_events` | 267 |
| `refresh_tokens` | 187 |
| `report_cards` | 1 |
| `room_types` | 3 |
| `school_years` | 1 |
| `students` | 2 |
| `subjects` | 1 |
| `teacher_assignments` | 1 |
| `teacher_skills` | 1 |
| `teachers` | 2 |
| `user_security_tokens` | 13 |
| `users` | 7 |

### References historiques hors `tenant_id`

Une recherche agregee sur les catalogues, colonnes texte et JSON a trouve :

- 12 payloads historiques dans `iam_audit_logs` ;
- 267 payloads dans `outbox_events`, tous au statut `PROCESSED` ;
- 2 anciennes valeurs `users.avatar_url`.

Aucune politique RLS, vue, fonction, trigger ou valeur par defaut ne contient l'identifiant historique. Les payloads d'audit doivent rester immuables. Les payloads outbox traites doivent etre conserves ou archives selon la politique de retention, sans remplacement JSON aveugle. Les deux URL d'avatar relevent du plan de migration stockage LOT 4-PROD.

### Test sur copie jetable

Un dump limite par RLS a ete restaure dans un PostgreSQL Docker en `tmpfs`. Les agregats de la copie correspondaient exactement au snapshot. Les quatre migrations du depot absentes du snapshot ont ensuite ete appliquees uniquement a la copie :

- `20260714130000_secure_storage_metadata` ;
- `20260716113000_notification_delivery_reliability` ;
- `20260716160000_nullable_unique_concurrency_hardening` ;
- `20260716170000_payment_provider_token_scope`.

La copie comportait alors 34 migrations appliquees et 0 migration echouee.

La migration candidate testee :

1. prend un advisory lock transactionnel ;
2. impose un `lock_timeout` et un `statement_timeout` ;
3. exige l'inventaire exact des 42 tables ;
4. compte ancien et nouveau tenants avant toute ecriture ;
5. refuse l'absence de source ou toute presence de la cible ;
6. met a jour les 42 colonnes dans une transaction ;
7. verifie les comptes et l'integrite avant commit.

Resultats :

- migration avant mise a niveau du schema : 758/758 lignes, 42 tables, succes ;
- rollback immediat : 758/758 lignes, succes ;
- collision simulee d'une ligne canonique : refus avant toute mise a jour, avec transaction annulee ;
- migration apres mise a niveau aux 34 migrations : 758/758 lignes, succes ;
- apres migration : 0 historique, 758 canoniques, 0 NULL, 18 tables peuplees, 0 anomalie relationnelle ;
- rollback immediat sur le schema courant : 758/758 lignes et retour exact aux agregats initiaux.

Le dump, les scripts temporaires et la base jetable ne constituent pas des artefacts a committer.

### Strategie de migration et rollback

La migration de production doit rester un changement de maintenance coordonne :

1. arreter les ecritures API et worker ;
2. creer et verifier une sauvegarde PostgreSQL immutable ;
3. relancer le preflight lecture seule sur la base courante ;
4. verifier que la cible reste absente et que les 42 tables sont identiques ;
5. verifier que le role de migration direct peut executer les mises a jour malgre RLS ;
6. appliquer une nouvelle migration Prisma transactionnelle via le job controle ;
7. deployer dans la meme fenetre la configuration et le code avec l'UUID canonique ;
8. retirer `ALLOW_LEGACY_DEFAULT_TENANT_ID` et l'exception du validateur ;
9. verifier 0 ligne historique, les relations, l'authentification, les sessions, le worker et les routes tenant ;
10. rouvrir les ecritures uniquement apres les smoke tests.

Rollback :

- avant reprise du trafic : migration inverse transactionnelle, uniquement si aucune nouvelle ligne canonique n'a ete creee ;
- apres reprise du trafic : ne pas faire de remplacement inverse global, car les lignes migrees et les nouvelles lignes ne sont plus distinguables ; restaurer la sauvegarde pre-migration et redeployer ensemble l'ancienne configuration et l'ancien code.

### Limites, risques et verdict

- Le snapshot est recent mais ne prouve pas qu'aucune ecriture n'a eu lieu en production depuis sa creation. Le preflight doit etre repete juste avant migration.
- Les domaines parents, inscriptions, finance, notifications et plusieurs tables scolaires sont vides ; les contraintes ont ete testees, mais les volumes ne sont pas representatifs.
- Les references historiques dans audit, outbox et avatar ne doivent pas etre modifiees par la migration tenant.
- Le snapshot etait initialement a 30 migrations. La compatibilite avec les 34 migrations du depot a ete testee sur la copie.

Verdict LOT 1B : **GO pour preparer la migration canonique versionnee et son commit ; NO-GO pour l'appliquer en production tant que la fenetre de maintenance, la sauvegarde verifiee, le preflight final, le role de migration et le traitement des avatars historiques ne sont pas valides**.

## LOT 1C - Migration canonique du tenant historique

- Date : 2026-07-26
- Ancien tenant : `00000000-0000-0000-0000-000000000001`
- Tenant canonique : `00000000-0000-4000-8000-000000000001`
- Statut : migration et configuration preparees ; aucune ecriture sur le snapshot source ou la production

### Correction

La migration transactionnelle
`20260726120000_canonical_default_tenant_id` inventorie explicitement les
42 tables tenant. Avant toute mise a jour, elle controle l'inventaire, le type
UUID, les contraintes non validees, les valeurs NULL ou inattendues, la
coexistence ancien/nouveau tenant et toutes les relations entre tables
tenant. Elle ne met a jour que les colonnes `tenant_id`, compte les lignes
effectivement modifiees, repete les controles apres ecriture et reconnait une
base vide ou deja migree.

La configuration active, les seeds, fixtures, tests et valeurs par defaut
utilisent maintenant l'UUID canonique. Le drapeau
`ALLOW_LEGACY_DEFAULT_TENANT_ID` et sa branche de validation ont ete retires.
L'ancien UUID est refuse par les validateurs. Ses seules references restantes
sont historiques ou indispensables a la migration et aux tests de refus.

### Validation sur copie jetable du snapshot

Le snapshot source est reste strictement en lecture seule. Une copie en
`tmpfs` a ete creee depuis `PROD_SNAPSHOT_DATABASE_URL`, puis detruite apres
les tests.

Resultats de la sequence :

- etat initial de la copie : 30 migrations, 42 tables, 758 lignes historiques
  dans 18 tables ;
- migrations 31 a 34 : appliquees dans l'ordre, 0 echec ;
- migration LOT 1C : appliquee comme migration 35, 758/758 lignes migrees ;
- etat final : 42 tables, 758 lignes canoniques, 0 ancien tenant, 0 NULL,
  0 tenant inattendu et 0 anomalie relationnelle ;
- rejeu du SQL sur la base deja migree : succes controle avec
  `LOT1C_ALREADY_MIGRATED` ;
- collision cible simulee : blocage avant ecriture avec
  `LOT1C_CANONICAL_TENANT_COLLISION` ;
- tenant inattendu simule : blocage avant ecriture avec
  `LOT1C_UNEXPECTED_TENANT_IDS` ;
- tenant NULL simule : blocage avant ecriture avec
  `LOT1C_NULL_TENANT_IDS` ;
- rollback avant trafic : 758/758 lignes restaurees, puis migration canonique
  reappliquee avec succes.

Les agregats historiques sont restes identiques avant et apres :

- 12 payloads `iam_audit_logs` contenant la reference historique ;
- 267 payloads `outbox_events` au statut `PROCESSED` ;
- 2 anciennes valeurs `users.avatar_url`.

Le controle final du snapshot source a confirme son integrite : 30 migrations,
758 lignes historiques, 0 ligne canonique, 0 NULL et 0 tenant inattendu.

### Validations applicatives

| Controle | Resultat |
| --- | --- |
| Prisma validate et generate | OK |
| Lint et build API | OK |
| Tests unitaires API | 20 suites, 99 tests reussis |
| Migration PostgreSQL 16 vierge | 35/35 migrations, 0 echec |
| E2E PostgreSQL complet | 9 suites, 61 tests reussis |
| Lint frontend | OK |
| Tests frontend | 24 fichiers, 109 tests reussis |
| Build et smoke frontend | OK |
| `git diff --check` | a relancer au controle final |

### Production et rollback

La procedure complete est documentee dans
`docs/operations/canonical-tenant-migration.md`. La production exige une
maintenance coordonnee : arret API/worker, sauvegarde verifiee, preflight
lecture seule sur la base courante, migrations 31 a 34 puis LOT 1C, mise a
jour simultanee de `DEFAULT_TENANT_ID`, deploiement API puis worker,
revocation des anciennes sessions, smoke tests et reprise des ecritures.

Avant la reprise du trafic, le rollback inverse est possible sous preflight
strict. Apres reprise des ecritures, la restauration de la sauvegarde et le
redeploiement coordonne de l'ancienne version sont obligatoires. La reprise
des ecritures est le point de non-retour du rollback inverse simple.

Verdict LOT 1C : **GO pour commit ; NO-GO pour migration ou deploiement en
production tant que la sauvegarde, le preflight final, le role de migration,
la maintenance API/worker, la revocation des sessions et les smoke tests ne
sont pas prepares et approuves**.

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

## LOT 2B - Dependances et outils de developpement (2026-07-18)

### Diagnostic initial

L'audit complet du lockfile avec le client compatible Bulk Advisory remontait
52 vulnerabilites exclusivement situees dans les dependances de developpement :
1 critique, 28 hautes, 18 moderees et 5 faibles. L'audit `--prod` restait propre.
Les chemins concernaient le CLI Nest, Jest/ts-jest, ESLint, Vite/Vitest, jsdom et
leurs transitives. Aucun de ces chemins n'est embarque dans l'artefact de
production.

| Package vulnerable | Versions avant | Avis avant | Severites | Origine principale | Etat final |
| --- | --- | ---: | --- | --- | --- |
| `handlebars` | 4.7.8 | 8 | critique/haute/moderee/faible | ts-jest | 4.7.9, corrige |
| `minimatch` | 3.1.2 / 9.0.5 / 10.2.1 | 8 | haute | Nest CLI, Jest, ESLint | 3.1.4 / 9.0.7 / 10.2.5, corrige |
| `undici` | 7.25.0 | 7 | haute/moderee/faible | jsdom | 7.28.0, corrige |
| `vite` | 7.3.1 | 5 | haute/moderee | Vite/Vitest | 7.3.6, corrige |
| `brace-expansion` | 1.1.12 / 2.0.2 / 5.0.2 | 4 | moderee | minimatch/glob | 1.1.13 / 5.0.7, corrige |
| `picomatch` | 2.3.1 / 4.0.2 / 4.0.3 | 4 | haute/moderee | Jest, Nest CLI, Vite | 2.3.2 / 4.0.4, corrige |
| `ajv` | 6.12.6 / 8.17.1 | 2 | moderee | Angular devkit, webpack, ESLint | 6.14.0 / 8.18.0, corrige |
| `fast-uri` | 3.1.0 | 2 | haute | ajv | 3.1.2, corrige |
| `flatted` | 3.3.3 | 2 | haute | ESLint/flat-cache | 3.4.2, corrige |
| `serialize-javascript` | 6.0.2 | 2 | haute/moderee | Nest CLI/webpack | version corrigee via Nest CLI |
| `form-data` | 4.0.5 | 1 | haute | types Supertest | 4.0.6, corrige |
| `rollup` | 4.57.1 | 1 | haute | Vite | 4.59.0, corrige |
| `postcss` | 8.5.6 | 1 | moderee | Vite | 8.5.10, corrige |
| `qs` | 6.15.0 | 1 | moderee | Nest CLI | 6.15.3, corrige |
| `@babel/core` | 7.29.0 | 1 | faible | Jest et plugin React | 7.29.6, corrige |
| `esbuild` | 0.27.3 | 1 | faible | Vite 7 | reste : correctif hors plage Vite 7 |

Le nombre d'avis et le nombre de chemins vulnerables ne sont pas identiques :
un meme avis peut affecter plusieurs versions ou plusieurs chemins. Les 50 avis
du rapport initial correspondaient aux 52 vulnerabilites agregees par pnpm.

### Mises a jour directes et breaking changes

Les versions directes ont ete mises a jour dans leur version majeure existante :

- backend : `@nestjs/cli` 11.0.16 -> 11.0.24, Jest 30.2.0 -> 30.4.2,
  ts-jest 29.4.6 -> 29.4.11 ;
- frontend : Vite 7.3.1 -> 7.3.6 et Vitest 4.1.5 -> 4.1.10 ;
- les deux applications : TypeScript-ESLint 8.56.0 -> 8.64.0.

Les migrations majeures TypeScript 7, ESLint 10, Vite 8, React 19, Prisma 7,
plugin React 6 et types Node 26 ont ete volontairement exclues : elles demandent
une analyse de compatibilite distincte et n'etaient pas necessaires pour supprimer
les severites critique, haute et moderee. Aucune configuration Jest, Vite, jsdom,
ESM/CommonJS, alias ou timeout n'a ete modifiee.

### Overrides transitifs bornes

Apres les mises a jour directes et `pnpm dedupe`, certaines versions uniques
restaient verrouillees bien que les parents acceptent les correctifs. Des
overrides racine, limites aux plages vulnerables, resolvent uniquement :
`@babel/core`, `ajv`, `brace-expansion` 1.x, `fast-uri`, `flatted`, `form-data`,
`minimatch` 3.x/9.x, `picomatch` 2.x/4.x, `postcss`, `rollup` et `undici`.

Ils sont lus par pnpm 10.24.0 lors de l'installation et materialises dans le
lockfile. Le client pnpm 11 dedie a l'audit avertit qu'il n'interprete plus le
champ `pnpm.overrides`, mais il audite bien le lockfile resolu sans le modifier.
Plan de retrait : avant le LOT 10, reexecuter `pnpm why` apres chaque mise a jour
des parents et supprimer individuellement tout override devenu inutile, avec
installation figee, audit et non-regression complets.

`esbuild` 0.27.3 n'est pas force vers 0.28.1 : Vite 7.3.6 declare `^0.27.0` et,
pour un package 0.x, 0.28 est une version incompatible. L'avis restant est faible,
limite au serveur de developpement sous Windows et n'est pas present dans les
dependances de production. Mitigation : ne pas exposer le serveur Vite sur un
reseau non fiable. Echeance : reevaluer avec une version de Vite acceptant
esbuild >=0.28.1 avant le LOT 10.

### Resultats avant/apres

| Etape | Critique | Haute | Moderee | Faible |
| --- | ---: | ---: | ---: | ---: |
| Initial | 1 | 28 | 18 | 5 |
| Apres groupe backend | 0 | 21 | 13 | 4 |
| Apres groupe frontend | 0 | 17 | 10 | 4 |
| Apres groupe qualite et transitives | 0 | 0 | 0 | 1 |

| Controle | Resultat |
| --- | --- |
| Installation pnpm 10.24.0 figee | OK |
| Prisma generate | OK |
| Lint et build API | OK |
| Tests unitaires API | OK, 17 suites et 87 tests |
| E2E PostgreSQL 16 | OK, 9 suites et 61 tests |
| Lint frontend | OK |
| Tests frontend | OK, 15 fichiers et 70 tests |
| Build frontend | OK, Vite 7.3.6 |
| Smoke frontend | OK |
| Audit visuel mocked CI | OK, 61/61 et 0 constat |
| Audit visuel mocked complet | OK, 121/121 et 0 constat |
| Audit complet pnpm 11.13.0 | 1 faible, 0 critique/haute/moderee |
| Audit production pnpm 11.13.0 | OK, aucune vulnerabilite connue |
| Lockfile avant/apres audit pnpm 11 | Identique |
| `git diff --check` | OK avant documentation finale |

Le premier run unitaire API lance en parallele avec plusieurs controles lourds a
depasse le timeout historique de 5 secondes sur un test d'archive. Le meme test et
la suite complete, relances seuls sans modifier le timeout, ont reussi 87/87. Ce
constat est documente comme saturation locale, pas masque par une configuration.

Verdict LOT 2B : **GO** pour revue. L'objectif obligatoire est atteint : aucune
vulnerabilite critique, haute ou moderee dans l'outillage, aucune vulnerabilite de
production et une seule dette faible non forcee car le correctif sort de la plage
compatible de Vite 7. Aucun comportement metier ni contrat API n'a change.

Message de commit propose :
`fix(dev-deps): remediate development tooling vulnerabilities`.

## LOT 8A - Configuration runtime frontend et feature flags (2026-07-18)

### Diagnostic initial

Le frontend possedait trois niveaux de repli implicites pour l'API : l'URL
`VITE_API_BASE_URL`, une URL Render codee en dur et le chemin relatif `/api/v1`.
Le hook de session ajoutait encore son propre repli relatif. Une preview Vercel
mal configuree pouvait donc contacter silencieusement l'API de production ou
l'origine Vercel. Le build n'imposait aucune variable API.

Les modules provisoires n'etaient pas gouvernes par une politique centrale :
le portail eleve et Mosquee affichaient des placeholders, la messagerie utilisait
un historique de demonstration non persiste et la facturation utilisateur
affichait un ecran non branche. Leurs routes et actions restaient accessibles.

### Configuration API retenue

`api-runtime-config.ts` est la source de validation pure et testable :

- developpement : `/api/v1` ou URL HTTP(S) loopback explicite ; le proxy Vite
  lui-meme est limite a une cible loopback ;
- test : endpoint mock explicite accepte, avec `/api/v1` comme origine du mode
  de test mocke ;
- preview, staging et production : URL HTTPS absolue obligatoire, sans
  identifiants, query string, fragment ou localhost ;
- aucune URL Render ou fallback heberge n'existe dans le code runtime ;
- le chargement de la configuration Vite fait echouer le build avant emission
  de l'artefact lorsque la variable est absente ou invalide.

La CI fournit uniquement pour son build une URL reservee `.invalid`. Vercel ne
contient aucune valeur metier dans `vercel.json` : `VITE_API_BASE_URL` doit etre
definie explicitement pour chaque environnement dans la console Vercel.

### Matrice des feature flags

| Flag | Ecran | Etat par defaut | Effet desactive |
| --- | --- | --- | --- |
| `VITE_FEATURE_STUDENT_PORTAL` | Portail eleve | `false` | navigation masquee, acces direct explicite |
| `VITE_FEATURE_MOSQUEE` | Mosquee | `false` | navigation masquee, acces direct explicite |
| `VITE_FEATURE_MESSAGES` | Messagerie demo | `false` | action et icone masquees, acces direct explicite |
| `VITE_FEATURE_USER_BILLING` | Facturation utilisateur | `false` | action utilisateur masquee, acces direct explicite |

Seule la valeur exacte `true` active un flag. Le registre d'ecrans distingue
desormais le droit du role, la fonctionnalite desactivee et l'absence de session.
Un acces direct a un module desactive affiche un etat stable sans fausse donnee,
avec une sortie vers le tableau de bord ou le profil selon les droits du role.
Les modules actifs, les donnees metier et les contrats API ne sont pas modifies.

### Scripts visuels historiques

L'inventaire de l'arbre courant contient 13 scripts legacy, et non 14. Leur liste
exacte est documentee dans `docs/runbooks/visual-audit.md`. Aucun n'est appele par
la CI ou un script de release ; le gate officiel reste
`scripts/visual-audit-core-workflows.mjs`. Ils sont conserves jusqu'au LOT 8D.

### Validations

| Controle | Resultat |
| --- | --- |
| Tests cibles API runtime, flags, navigation et etat desactive | OK, 17 tests |
| Tests frontend complets | OK, 19 fichiers et 84 tests |
| Lint frontend | OK |
| Build frontend avec URL HTTPS explicite | OK, Vite 7.3.6 |
| Build production sans `VITE_API_BASE_URL` | Echec attendu et explicite avant build |
| Smoke frontend | OK |
| Audit visuel mocked CI | OK, 61/61 et 0 constat |
| Audit visuel mocked complet | OK, 121/121 et 0 constat |
| `git diff --check` | OK avant documentation finale |

### Risques et actions d'exploitation

Les modules restent presents dans les chunks lazy ; ce lot les isole sans les
supprimer ni les finaliser. Leur activation exige une recette fonctionnelle et
metier distincte. L'audit visuel integre n'est pas relance dans ce lot, qui ne
modifie aucun contrat API.

Avant chaque deploiement Vercel, configurer `VITE_API_BASE_URL` separement pour
Preview et Production, conserver les quatre flags a `false`, puis ne mettre un
flag a `true` que dans une recette explicitement approuvee. Aucune variable
`VITE_API_FALLBACK_BASE_URL` ne doit etre recreee.

Verdict LOT 8A : **GO** pour revue. La configuration ne peut plus basculer
silencieusement vers Render et les fonctions provisoires sont opt-in, masquees
et refusees proprement par defaut.

Message de commit propose :
`fix(web-admin): require explicit API runtime and gate provisional features`.

## LOT 8B - Orchestration frontend et decoupage de App.tsx (2026-07-18)

### Diagnostic et metriques initiales

`App.tsx` concentrait encore l'etat de tous les domaines, les loaders, la
construction des donnees agregees et la selection de chaque ecran. Les hooks
existants isolaient deja l'authentification, le bootstrap, les preferences et les
effets du shell ; ces frontieres ont ete conservees plutot que dupliquees.

| Responsabilite | Emplacement avant | Dependances | Destination retenue |
| --- | --- | --- | --- |
| Session et appels authentifies | `App.tsx` + `use-auth-session-resilient` | stockage session, API | hook existant conserve, orchestration minimale dans `App.tsx` |
| Login, activation et reset | `App.tsx` + `use-auth-flows` | session, URL, formulaires | hook existant conserve |
| Bootstrap par role | `App.tsx` + `use-app-bootstrap` | permissions, loaders | hook existant conserve |
| Etats de donnees metier | 33 states disperses dans `App.tsx` | tous les ecrans | `use-app-data.ts`, source de verite groupee et actions stables |
| Loaders metier | callbacks dans `App.tsx` | API, role, session | `useAppDataLoaders` dans `use-app-data.ts` |
| Selection et props des ecrans | `renderActiveScreen` et 14 helpers locaux | lazy screens, RBAC, flags | routeur pur `app-screen-router.tsx` |
| RBAC et feature flags | registre existant + `App.tsx` | role, flags LOT 8A | registre conserve, decision appliquee avant chargement de l'ecran |
| Navigation et recherche | modele existant + `App.tsx` | role, langue, ecran | `app-navigation-model` conserve |
| Langue, RTL et theme | `use-app-preferences` + `App.tsx` | stockage local, DOM racine | hook existant conserve |
| Toasts et notifications UI | `App.tsx`, `GlobalToastLayer`, header | API, compteurs | presentation conservee ; seul le calcul du compteur reste transversal |
| Panneaux globaux du header | `HeaderNavigation` | actions et session | propriete locale du header conservee, tests ouverture/fermeture existants |
| Tables responsives / observer DOM | `use-app-shell-effects` | DOM du shell | strictement inchange, reporte au LOT 8C |
| Shell et footer | `App.tsx` + `app-shell-panels` | navigation, session | composition conservee dans `App.tsx` |

Mesures AST reproductibles sur le fichier principal :

| Metrique `App.tsx` | Avant | Apres | Delta |
| --- | ---: | ---: | ---: |
| Lignes | 1 239 | 526 | -713 (-57,5 %) |
| Hooks appeles | 67 | 24 | -43 |
| `useState` | 41 | 8 | -33 |
| `useCallback` | 13 | 5 | -8 |
| `useMemo` | 6 | 2 | -4 |
| `useRef` | 1 | 1 | 0 |
| `useEffect` direct | 0 | 0 | 0 |
| Conditions `if` | 53 | 10 | -43 |
| Imports nommes ou par defaut | 92 | 39 | -53 |

### Architecture appliquee

`App.tsx` est maintenant limite a la composition de la session, des preferences,
du bootstrap, du modele de navigation et du shell. Deux frontieres ont ete
ajoutees :

- `use-app-data.ts` porte une seule source de verite pour les donnees chargees,
  les mises a jour atomiques des domaines et les loaders dependants de la
  session ;
- `app-screen-router.tsx` est un routeur pur et exhaustif. Il applique d'abord la
  decision RBAC/feature flag, puis transmet aux ecrans lazy les memes contrats
  qu'avant. Son fallback historique reste le tableau de bord.

Le routeur (440 lignes) ne contient ni state, ni effet, ni appel reseau. Le
controleur de donnees (310 lignes) ne contient aucun JSX. Ils ne reproduisent donc
pas le monolithe initial et disposent chacun de tests cibles. Aucun provider
artificiel, contexte global ou nouvelle bibliotheque d'etat n'a ete ajoute.

Les comportements de preview ont ete compares au code precedent : l'entree en
preview vide bien le profil courant et les donnees de session, puis hydrate les
fixtures. Les routes, identifiants d'ecran, formulaires, modales, permissions,
flags, langues, theme et contrats API restent inchanges.

### Tests et non-regression

Les nouveaux tests couvrent : etat vide/hydratation/clear des donnees, actions
stables, quatre grandes familles de navigation, route interdite, flag desactive
avant chargement lazy, absence de session, session expiree, sonde API initiale,
langue arabe/RTL/theme sombre et conservation des tokens d'activation/reset dans
l'URL. Les tests existants du header couvrent toujours ouverture, fermeture,
clic exterieur et panneaux globaux.

| Controle | Resultat |
| --- | --- |
| Tests cibles d'orchestration | OK, 5 fichiers et 20 tests |
| Tests frontend complets | OK, 23 fichiers et 103 tests |
| Lint frontend | OK |
| Build frontend | OK, Vite 7.3.6, 155 modules |
| Smoke frontend | OK |
| Audit visuel mocked CI | OK, 61/61 workflows, 0 constat |
| Audit visuel mocked complet | OK, 121/121 workflows, 0 constat |
| Requetes API non mockees / console / pageerror / loading / overflow | 0 constat |
| `git diff --check` | OK avant documentation finale |

### Bundle et dettes restantes

Le CSS est strictement identique (`443 532` octets et meme hash de chunk). Le
chunk JS principal passe de `387 907` a `389 604` octets, soit `+1 697` octets
(`+0,44 %`) ; gzip passe de `114 531` a `115 352` octets, soit `+821` octets
(`+0,72 %`). Les chunks lazy restent separes et aucun chargement API
supplementaire n'apparait dans les audits stricts.

Le LOT 8C reste responsable des observers DOM de traduction/tableaux. Le LOT 8D
reste responsable de la consolidation CSS et du retrait des 13 scripts visuels
legacy. Ces zones n'ont pas ete modifiees dans cette passe.

Verdict LOT 8B : **GO** pour revue. L'orchestration est nettement plus courte et
testable, sans changement fonctionnel ou visuel detecte. Aucune action manuelle
n'est requise avant revue ; l'audit integre reste reserve au LOT 10.

Message de commit propose :
`refactor(web-admin): split app orchestration by responsibility`.

## LOT 8C - I18n et tableaux sans observers DOM globaux (2026-07-18)

### Diagnostic initial

Deux `MutationObserver` applicatifs etaient attaches au contenu global de
`<main>` :

| Observer | Fichier initial | Portee | Effet | Dependances implicites | Remplacement |
| --- | --- | --- | --- | --- | --- |
| Traduction DOM | `shared/i18n.ts` | tout `<main>` | parcours de tous les textes et reecriture de `textContent`, placeholder, title, aria-label, alt et data-label | shell et ecrans avec libelles francais rendus directement | `I18nProvider`, `useI18n` et traduction avant rendu |
| Tables responsives | `app/use-app-shell-effects.ts` | toutes les tables sous `<main>` | copie des en-tetes dans `data-label` apres chaque mutation | tables sans metadonnees mobiles locales | metadonnees React locales et bridge strictement limite aux ecrans legacy |

Aucun `ResizeObserver` ou `IntersectionObserver` applicatif n'etait present.
L'inventaire source comptait 46 tables de production dans 21 fichiers, dont 35
avec `data-responsive-table` explicite. Les ecrans anciens dependaient encore du
decorateur global pour completer leurs cellules et du traducteur DOM pour leurs
libelles. Une mutation representative sur Inscriptions observait un DOM de 482
noeuds et le changement FR vers EN produisait 157 enregistrements traites par
les observers applicatifs.

### Strategie appliquee

- `I18nProvider` et `useI18n` fournissent langue, direction et fonction `t` sans
  reecriture du DOM ;
- le shell, la sidebar, les panneaux du header, le routeur, les ecrans lazy,
  Dashboard et Inscriptions traduisent maintenant leurs textes, placeholders,
  titres, labels accessibles et labels mobiles avant rendu ;
- les notifications libres retournees par l'API sont identifiees comme donnees
  metier et ne passent pas dans la traduction du Dashboard ;
- Inscriptions fournit declarativement ses sept labels de colonnes mobiles ;
- l'ancien observer de `use-app-shell-effects.ts` et `useDomTranslation` sont
  supprimes ;
- un bridge temporaire `LegacyDomEnhancementsBoundary` est limite au seul
  sous-arbre de l'ecran legacy actif. Il est detruit au demontage, regroupe les
  mutations dans une frame et ne peut pas envelopper le shell ;
- un test statique scanne tout `src` et interdit tout autre constructeur
  `MutationObserver` applicatif ou rebranchement global des anciens helpers.

Les 18 identifiants d'ecran encore sous bridge local sont : IAM, enseignants,
salles, eleves, parents, referentiel, comptabilite, messagerie, rapports,
mosquee, notes et bulletins, pilotage, absences, emploi du temps, notifications,
portails enseignant, parent et eleve. Ce perimetre residuel est explicite : il ne
constitue plus un observer global, mais reste une dette a migrer ecran par ecran.

### Cycle de vie, accessibilite et performance

Les tests couvrent le changement de langue a chaud, le contenu lazy, les
interpolations, les placeholders et aria-label, RTL, les donnees libres, les
labels de colonnes, le sous-arbre local et le demontage en React Strict Mode.
La boundary ne modifie aucun noeud exterieur a son propre `ref`.

| Mesure representative | Avant | Apres |
| --- | ---: | ---: |
| Observers DOM applicatifs globaux | 2 | 0 |
| Enregistrements traites apres FR vers EN sur Inscriptions | 157 | 0 |
| Temps observe avec fenetre fixe de stabilisation de 500 ms | 624 ms | 619 ms |
| Observer residuel sur un ecran declaratif | global sur `<main>` | aucun |
| Observer residuel sur Enseignants legacy | global sur `<main>` | 1 local, 11 enregistrements initiaux et 0 apres changement de langue |
| Chunk JS principal | 389 604 octets | 391 551 octets |
| Chunk JS principal gzip | 115 352 octets | 115 487 octets |
| CSS global | 443 532 octets | 443 532 octets |

Le delta du chunk principal est de +1 947 octets brut (+0,50 %) et +135 octets
gzip (+0,12 %). Aucune nouvelle dependance n'a ete ajoutee et le CSS est
strictement inchange.

### Validations

| Controle | Resultat |
| --- | --- |
| Tests i18n, observers, Strict Mode et tableaux cibles | OK, 4 fichiers et 29 tests |
| Tests frontend complets | OK, 25 fichiers et 108 tests |
| Lint frontend | OK |
| Build frontend avec URL API explicite | OK, Vite 7.3.6, 157 modules |
| Smoke frontend | OK |
| Audit visuel mocked CI | OK, 61/61 workflows et 0 constat |
| Matrice Dashboard/Inscriptions FR, EN, AR et RTL | OK dans les tests et le gate CI |
| Audit visuel mocked complet | OK, 121/121 workflows, 121 captures, 0 constat et 0 requete inattendue |
| Audit visuel integre | Reporte au LOT 10 comme prevu |
| `git diff --check` | A relancer apres cette documentation |

Le premier passage du gate CI a expose quatre libelles Dashboard encore rendus
en francais (`Taches prioritaires` et `Alertes & suivi` en EN/AR). Ils ont ete
convertis en rendu declaratif, leurs traductions et tests ajoutes, puis le gate
a reussi 61/61 sans allowlist.

### Dette residuelle et actions

Le LOT 8D reste responsable de la consolidation CSS et du retrait des 13 scripts
visuels legacy. La migration declarative des 18 ecrans encore sous bridge local
devra continuer par composant ; aucune exception globale ne doit etre ajoutee.
Le risque temporaire restant est la traduction par inspection du sous-arbre dans
ces seuls ecrans legacy. Les composants deja migres et les donnees libres du
Dashboard n'utilisent plus ce mecanisme.

Aucune action de configuration n'est requise de l'utilisateur. L'audit mocked
complet est valide ; conserver l'audit integre pour le LOT 10.

Verdict LOT 8C : **GO pour revue**, avec bridge local temporaire documente et
audit mocked complet valide sans constat.

Message de commit propose :
`refactor(web-admin): replace global DOM observers with scoped React boundaries`.

## LOT 8D - Migration declarative finale et dette visuelle (2026-07-21)

### Diagnostic et metriques initiales

L'audit a inventorie 25 fichiers CSS, 24 896 lignes, 571 119 octets source,
1 202 declarations `!important`, 125 media queries et 4 styles React inline.
Le build initial produisait un chunk CSS global de 443 532 octets (68 469
octets gzip) et un chunk JS principal de 391 551 octets (115 698 octets gzip).
Le parseur CSS a releve 22 regles strictement identiques pouvant etre retirees
sans arbitrage visuel. Les autres repetitions de selecteurs correspondent a la
cascade, aux themes ou aux breakpoints et n'ont pas ete traitees comme mortes
sans preuve.

| Fichier CSS | Lignes finales | Octets | `!important` | Responsabilite | Dette et decision |
| --- | ---: | ---: | ---: | --- | --- |
| `premium-v3-foundation.css` | 4 658 | 118 442 | 345 | fondation V3 | monolithe conserve, consolidation future par domaine |
| `features.css` | 3 472 | 79 103 | 0 | ecrans metier | 7 doublons stricts retires |
| `erp-refinement.css` | 3 025 | 75 377 | 142 | raffinements historiques | specifite historique conservee |
| `layout.css` | 1 713 | 34 427 | 29 | shell et grilles | 10 doublons et une media query vide retires |
| `auth-premium.css` | 1 399 | 30 438 | 0 | authentification premium | conserve |
| `theme-overrides.css` | 1 196 | 22 236 | 0 | clair/sombre | 2 doublons stricts retires |
| `responsive.css` | 1 095 | 22 107 | 47 | responsive historique | conserve apres audit visuel |
| `auth.css` | 943 | 20 499 | 0 | authentification | conserve |
| `mobile-product.css` | 912 | 27 077 | 359 | experience mobile | dette haute, mais pas de reecriture sans comparaison visuelle dediee |
| `header.css` | 896 | 18 292 | 0 | header | conserve |
| `profile-premium.css` | 849 | 18 490 | 3 | profil | conserve |
| `tables.css` | 798 | 23 731 | 180 | tableaux responsifs | 1 doublon strict retire, budget surveille |
| `utilities.css` | 739 | 14 757 | 48 | utilitaires | conserve |
| `feature-foundation.css` | 615 | 10 719 | 0 | base des modules | conserve |
| `pilotage.css` | 560 | 14 094 | 0 | pilotage | conserve |
| `controls-foundation.css` | 497 | 8 398 | 1 | controles | conserve |
| `forms.css` | 438 | 10 852 | 8 | formulaires | conserve |
| `responsive-foundation.css` | 243 | 3 617 | 0 | base responsive | 2 doublons stricts retires |
| `v3-module-unification.css` | 203 | 6 720 | 34 | homogeneite modules | conserve |
| `teachers.css` | 202 | 3 872 | 0 | enseignants | conserve |
| `globals.css` | 113 | 2 041 | 0 | tokens et reset | conserve comme source commune |
| `parents.css` | 68 | 1 508 | 0 | parents | conserve |
| `auth-canvas.css` | 57 | 886 | 0 | fond auth | conserve |
| `dashboard.css` | 50 | 768 | 0 | dashboard | conserve |
| `rooms.css` | 34 | 709 | 0 | salles | conserve |

### Migration des 18 ecrans legacy

Les textes d'interface, attributs accessibles, statuts, labels dynamiques et
metadonnees mobiles sont maintenant produits avant rendu par React et
`useI18n`. Les donnees metier libres ne sont pas traduites. Chaque table des
features declare `data-responsive-table` et chaque cellule fournit son
`data-label` traduit ou un `colSpan` explicite.

| Ecran | Composants migres | Etat |
| --- | --- | --- |
| IAM | `iam-screen.tsx` | declaratif |
| Enseignants | `teachers-screen.tsx`, liste | declaratif |
| Salles | `rooms-screen.tsx`, liste | declaratif |
| Eleves | `students-panel.tsx` | declaratif |
| Parents | `parents-screen.tsx`, liste | declaratif |
| Referentiel | ecran et six sections | declaratif |
| Comptabilite | `finance-screen.tsx` | declaratif |
| Messagerie | `messages-screen.tsx` | declaratif |
| Rapports | `reports-screen.tsx` | declaratif |
| Mosquee | `construction-page.tsx` | declaratif, feature flag conserve |
| Notes et bulletins | `grades-screen.tsx` | declaratif |
| Pilotage | `pilotage-screen.tsx` | declaratif |
| Absences | `school-life-panel.tsx` | declaratif |
| Emploi du temps | `school-life-panel.tsx` | declaratif |
| Notifications | `school-life-panel.tsx` | declaratif |
| Portail enseignant | `portal-teacher-screen.tsx` | declaratif, feature flag conserve |
| Portail parent | `portal-parent-screen.tsx` | declaratif |
| Portail eleve | `student-portal-placeholder-screen.tsx` | declaratif, feature flag conserve |

`LegacyDomEnhancementsBoundary` et `responsive-tables.ts` ont ete supprimes.
Le routeur rend directement les 18 ecrans. Il ne reste aucun constructeur
`MutationObserver` dans le code de production. Un test statique interdit son
retour, exige les metadonnees des tableaux et verifie l'absence de la boundary.

### Scripts visuels legacy

| Script supprime | Couverture de remplacement |
| --- | --- |
| `auth-iam-visual-audit.mjs` | authentification implicite et workflow IAM du gate central |
| `auth-visual-audit.mjs` | bootstrap/login de chaque workflow central et tests auth |
| `dashboard-visual-audit.mjs` | workflow Dashboard central |
| `enrollments-visual-audit.mjs` | workflow Inscriptions central |
| `finance-visual-audit.mjs` | workflow Comptabilite central |
| `iam-visual-audit.mjs` | workflow Utilisateurs et droits central |
| `parents-visual-audit.mjs` | workflow Parents central |
| `rooms-visual-audit.mjs` | workflow Salles central |
| `students-visual-audit.mjs` | workflow Eleves central |
| `teachers-visual-audit.mjs` | workflow Enseignants central |
| `visual-audit.mjs` | matrice officielle `visual-audit-core-workflows.mjs` |
| `visual-audit-notes-bulletins.mjs` | workflow Notes et bulletins central |
| `visual-audit-profile.mjs` | nouveaux workflows Profil, Preferences et Journal d'activite |

Avant le lot, 13 scripts legacy etaient encore presents mais aucun n'etait
utilise par la CI ou une release. Apres le lot, aucun ne subsiste et le runner
central est l'unique source de preuve. La facturation utilisateur reste
desactivee par feature flag et couverte par ses tests, sans fausse navigation
visuelle.

### Nettoyage CSS et garde anti-regression

Le retrait mecanique a ete limite a 22 regles dont le selecteur, le contexte
d'at-rule et les declarations etaient strictement identiques, en conservant la
derniere occurrence selon l'ordre reel d'import. Aucune règle seulement
similaire n'a ete supprimee. Les budgets du smoke sont fixes a 575 000 octets
source et 1 200 `!important` : ils autorisent une petite marge, mais bloquent le
retour immediat a l'etat initial. Le smoke interdit aussi les observers, la
boundary et les 13 scripts retires.

| Metrique | Avant | Apres | Evolution |
| --- | ---: | ---: | ---: |
| Fichiers CSS | 25 | 25 | 0 |
| Lignes CSS | 24 896 | 24 775 | -121 |
| CSS source | 571 119 | 569 160 octets | -1 959 octets |
| `!important` | 1 202 | 1 196 | -6 |
| Media queries | 125 | 124 | -1 |
| Chunk CSS global | 443 532 | 442 624 octets | -908 octets |
| Chunk CSS global gzip | 68 469 | 68 348 octets | -121 octets |
| Chunk JS principal | 391 551 | 391 095 octets | -456 octets |
| Chunk JS principal gzip | 115 698 | 115 185 octets | -513 octets |
| Ecrans sous boundary | 18 | 0 | -18 |
| Observers DOM applicatifs | 1 local temporaire | 0 | -1 |
| Scripts visuels legacy | 13 | 0 | -13 |

### Validations finales

| Controle | Resultat |
| --- | --- |
| Tests i18n/observers/tableaux cibles | OK, 2 fichiers et 8 tests lors de la migration |
| Tests frontend complets | OK, 24 fichiers et 109 tests |
| Lint frontend | OK |
| Build frontend | OK avec URL HTTPS explicite, Vite 7.3.6 et 155 modules |
| Refus d'une API localhost au build production | OK, echec explicite attendu |
| Smoke frontend | OK, 569 160 octets CSS, 1 196 `!important`, zero observer |
| Tests du collecteur visuel | OK, 6 tests |
| Lint du collecteur visuel | OK |
| Audit visuel mocked CI | OK, 67/67 workflows et zero constat |
| Audit visuel mocked complet | OK, 133/133 workflows et zero constat |
| `git diff --check` | A relancer apres cette documentation |

### Dette restante, actions et verdict

Les 1 196 `!important`, notamment dans `mobile-product.css`,
`premium-v3-foundation.css` et `tables.css`, restent une dette mesuree. Leur
retrait exige des comparaisons visuelles par composant et n'a pas ete simule par
une hausse de specificite. Les 4 styles inline restants sont dynamiques et n'ont
pas ete transformes sans benefice demontre. L'audit integre avec API,
PostgreSQL et Redis reels reste reserve au LOT 10.

Aucune action de configuration n'est requise de l'utilisateur pour ce lot.
Conserver les budgets smoke et le runner central comme gates officiels.

Verdict LOT 8D : **GO pour revue**, sans changement metier, backend, contrat API,
dependance ou design demande.

Message de commit propose :
`refactor(web-admin): complete declarative UI and retire legacy visual debt`.

## LOT 9 - Infrastructure, CI/CD et exploitation

Date de validation locale : 23 juillet 2026.

### Diagnostic initial

| Composant | Etat avant le lot | Risque confirme | Correction |
| --- | --- | --- | --- |
| GitHub Actions | un job principal, actions par tags, aucun Redis | controles incomplets et actions mutables | quatre gates separes, SHA immuables, Redis, timeouts et concurrence |
| Audit securite | audit pnpm production seulement | secrets, SAST, images et SBOM non controles | pnpm 11, Trivy, Semgrep et Syft |
| Render | migration pendant le build et auto-deploy actif | migration concurrente, promotion non controlee | build, migration et demarrage separes ; auto-deploy desactive |
| API et worker | aucun worker de production deploye | backlog outbox non consomme | images et processus dedies avec roles mutuellement exclusifs |
| Docker | aucun Dockerfile de production | runtime non reproductible et non scanne | trois cibles multi-stage, Node 22.22.0 par digest, non-root |
| Health | API uniquement | worker non observable | liveness/readiness API et worker |
| Metriques | endpoint protege mais scrape sans jeton | Prometheus recevait HTTP 403 | bearer token monte comme secret et alertes explicites |
| Logs | logger texte par defaut | correlation difficile et fuite potentielle | logs JSON, request ID borne, routes normalisees, donnees sensibles exclues |
| Sauvegarde | script PowerShell sans preuve de restauration | backup inutilisable ou non chiffre | scripts POSIX, checksum, chiffrement production et drill jetable |
| Deploiement | demarrage lie au build/migration | rollback et promotion ambigus | workflow de migration protege et runbooks |

Le depot ne contientait pas de Dockerfile. Le service Render gratuit etait
configure en auto-deploy, sans worker dedie. Le build Render executait
`prisma migrate deploy`, ce qui couplait compilation et mutation de schema.
La CI ne lancait ni Redis, ni typecheck explicite, ni secret scan, SAST, SBOM,
scan d'image ou exercice de restauration.

### Architecture appliquee

- `Backend/api/Dockerfile` produit `api`, `worker` et `migration`.
- L'image Node `22.22.0-bookworm-slim` et l'image
  `docker/dockerfile:1.7` du frontend BuildKit sont fixees par digest.
- Les runtimes retirent npm/corepack, inutiles en production.
- Les correctifs Debian disponibles sont installes avant le scan.
- L'API refuse tout traitement outbox/notification en production.
- Le worker exige `NOTIFICATIONS_WORKER_ENABLED=true` et expose ses propres
  endpoints de liveness/readiness.
- Les deux processus exigent PostgreSQL et Redis pour etre ready.
- Le job de migration est un processus unique distinct du build et du runtime.
- Les exemples Kubernetes utilisent un digest nul fail-closed a remplacer par
  le digest produit par la release.
- Le fichier Render principal conserve uniquement l'API gratuite existante ;
  le worker payant est fourni comme exemple et n'est pas cree.

La sequence de promotion documentee est :

1. CI et scans verts ;
2. sauvegarde chiffree et restauration jetable prouvee ;
3. preflight sur une copie representative ;
4. migration unique par environnement GitHub protege ;
5. deploiement API par digest ;
6. smoke/readiness API ;
7. deploiement worker par digest ;
8. controle backlog, erreurs et metriques ;
9. promotion frontend ;
10. rollback applicatif ou restauration controlee si necessaire.

### CI et supply chain

Le workflow principal contient les gates suivants :

- qualite : installation pnpm `10.24.0` figee, Prisma, typecheck, lint, builds,
  unitaires, PostgreSQL 16.14, Redis 7.4.7, migrations, E2E, frontend et smoke ;
- visuel : tests/lint du collecteur et audit mocke strict ;
- securite : audits pnpm `11.13.0`, Trivy filesystem, Semgrep local et SBOM
  source ;
- conteneurs : builds par SHA, validation runtime, restauration PostgreSQL,
  scans des trois images et SBOM de l'image API ;
- gate final : les quatre resultats doivent etre `success`.

Les actions GitHub sont fixees par SHA. Le gate d'audit verifie que pnpm
commence par `11.`. Semgrep, Syft et la version du scanner Trivy sont fixes. Les
SBOM, rapports Trivy/Semgrep et preuves de conteneurs sont conserves 30 jours,
y compris lorsque le scan echoue. Le controle des espaces compare le commit a
la base de la pull request ou au commit precedent, au lieu d'executer un diff
vide sur un checkout propre. Les anciennes executions de la meme branche sont
annulees.

Le workflow `production-migration.yml` est uniquement manuel. Il exige :

- un SHA exact ;
- un environnement GitHub protege ;
- une reference de sauvegarde ;
- une confirmation explicite ;
- le preflight Prisma et le statut final ;
- la conservation du journal de migration.

Il ne deploie aucune application.

### Observabilite

Les signaux ajoutes ou renforces couvrent :

- requetes API par methode, route normalisee et statut ;
- latence API et taux de 4xx/5xx ;
- etat PostgreSQL et Redis ;
- connexions Redis et statistiques memoire sures ;
- backlog et age de l'outbox ;
- notifications pending, retry et dead-letter ;
- erreurs d'operations Supabase Storage ;
- liveness/readiness API et worker.

Le request ID fourni par le client est accepte uniquement avec un alphabet
borne et une longueur maximale de 80 caracteres ; sinon un UUID serveur est
genere. Les logs ne contiennent pas JWT, refresh token, secret, destinataire
complet, contenu de notification ou document utilisateur.

Des alertes initiales sont definies pour l'indisponibilite API/DB/Redis, les
5xx, la latence, le backlog/lag outbox, les dead-letter et les erreurs storage.
Leur collecte reelle reste a brancher sur une solution approuvee.

### Sauvegarde et restauration

`backup-postgres.sh` :

- produit un dump PostgreSQL custom compresse ;
- verifie le catalogue ;
- calcule un SHA-256 et un manifeste ;
- exige `age` en production ;
- ecrit atomiquement ;
- applique une retention configurable.

`restore-postgres.sh` :

- verifie le checksum ;
- exige le nom exact de la base cible ;
- refuse les bases systeme ou non jetables ;
- dechiffre avec `age` si necessaire ;
- restaure avec nettoyage controle ;
- controle le statut des migrations lorsque Node est disponible.

L'exercice jetable a restaure les 34 migrations et une ligne sonde. Le garde de
production a refuse une sauvegarde non chiffree. Aucun backup de production n'a
ete lance.

Pour Supabase Storage, le plan documente impose l'inventaire des objets, la
comparaison aux metadonnees PostgreSQL, la detection des objets absents ou
orphelins et une politique de copie/replication a choisir selon le plan
Supabase. Aucune copie reelle n'a ete effectuee.

### Validations executees

| Controle | Resultat reel |
| --- | --- |
| Installation pnpm 10.24.0 figee | OK |
| Prisma validate/generate | OK, Prisma 6.19.3 |
| Typecheck monorepo | OK |
| Lint API/frontend | OK |
| Build API/frontend | OK |
| Build frontend sans URL API explicite | refus attendu, garde runtime actif |
| Build frontend avec URL HTTPS explicite | OK |
| Unitaires API | OK, 19 suites et 98 tests |
| Tests frontend | OK, 24 fichiers et 109 tests |
| E2E PostgreSQL/Redis | OK, 9 suites et 61 tests |
| Migration neuve | OK, 34/34 |
| Smoke frontend | OK |
| Audit visuel mocke CI | OK, 67/67 et zero constat |
| Audit visuel complet du LOT 8D | reference precedente OK, 133/133 |
| Tests du collecteur visuel | OK, 6/6 |
| Audit production pnpm 11 | OK, aucune vulnerabilite connue |
| Audit complet pnpm 11 niveau high | OK, zero critique/haute ; une faible esbuild |
| Semgrep local | OK, 5 regles, 314 fichiers TypeScript, zero constat |
| Trivy filesystem | OK, 593 cibles, zero critique/haute/secret/misconfiguration |
| Trivy images initial | ECHEC utile : 5 critiques et 32 hautes par image |
| Trivy images apres correction | OK, zero critique/haute sur les trois images |
| Validation conteneurs finaux | OK, migrations, non-root, probes, pannes DB/Redis, SIGTERM |
| SBOM source | OK, 1 284 paquets |
| SBOM image API | OK, 315 paquets |
| Drill backup/restore | OK, 34 migrations et sonde restaurees |
| YAML et scripts shell/Node | OK |
| Docker Compose | OK lors de la validation initiale du lot |
| `git diff --check` | OK |

Le premier scan d'image a prouve une faiblesse de la base Node : npm global
embarquait des versions vulnerables de `tar`, `glob`, `minimatch` et associes,
et Debian exposait des correctifs `libcap2`/`libgnutls30`. npm/corepack ont ete
retires des runtimes et les mises a jour Debian appliquees. Le second scan
hors reseau a retourne zero critique et zero haute pour API, worker et
migration.

L'audit complet pnpm conserve une seule alerte faible :
`esbuild < 0.28.1`, exploitable sur le serveur de developpement Windows. La CI
est Linux et les images de production n'embarquent pas Vite/esbuild. Cette
dette doit etre reevaluee au LOT 10.

### Controles impossibles dans cette passe

- Le nouvel audit visuel complet n'a pas pu etre relance : l'environnement
  d'execution a refuse l'ouverture du port Vite apres epuisement du quota
  d'approbation. L'audit CI 67/67 a bien ete execute dans ce lot ; aucun fichier
  UI source n'a ete modifie.
- Le second `docker compose config` a ete refuse par la meme limite
  d'approbation. Une validation Compose avait deja reussi avant ce blocage.
- Le dry-run Kubernetes client a demande la decouverte d'un cluster inexistant
  sur `localhost:8080`. Les documents YAML sont syntaxiquement valides, mais
  aucun cluster reel n'a ete contacte.
- `gh auth status` indique un jeton invalide. Les protections de branche,
  environnements GitHub et reviewers requis ne peuvent donc pas etre verifies.
- Les variables et protections Render/Vercel, les buckets Supabase, les
  sauvegardes gerees et les alertes externes ne sont pas inspectables depuis le
  depot local.
- `actionlint`, `shellcheck` et `hadolint` ne sont pas installes localement.
  Les scripts ont passe `bash -n`, les YAML ont ete parses et les images ont ete
  construites/scannees.

### Decisions, couts et actions utilisateur

Le deploiement reste bloque jusqu'aux decisions et preuves suivantes :

1. choisir un plan Render API sans mise en veille ;
2. approuver un background worker Render Starter ou une alternative ;
3. proteger `main` et rendre `Required CI gate` obligatoire ;
4. proteger l'environnement GitHub `production-migration` avec reviewers ;
5. configurer les secrets API, worker et migration separement ;
6. configurer Vercel Preview/Production avec `VITE_API_BASE_URL` et les quatre
   feature flags explicitement ;
7. verifier Redis dans la meme region, `noeviction`, URL privee et capacite ;
8. verifier les buckets Supabase prives et la sauvegarde/replication des objets ;
9. choisir une destination hors site chiffree et une cle `age` pour les dumps ;
10. prouver une restauration depuis une copie representative ;
11. choisir un collecteur de metriques et un canal d'alerte ;
12. publier les images par SHA, enregistrer leurs digests et deployer uniquement
    ces digests ;
13. conserver Brevo/SMS desactives jusqu'au LOT 5B.

Le plan Render gratuit actuel ne fournit ni background worker gratuit ni
pre-deploy job. Il est adapte a une demonstration, pas a l'exploitation
production cible.

### Verdict

- **LOT 9 code et validations locales : GO pour revue.**
- **Commit : GO apres revue du diff, sans push automatique.**
- **Deploiement production : NO-GO.**

Le NO-GO production est lie aux ressources et preuves externes : worker dedie,
protections GitHub, secrets, sauvegarde chiffree hors site, restauration
representative, buckets prives et monitoring reel. Aucun de ces controles n'a
ete simule.

Message de commit propose :
`chore(infra): harden CI deployment and operations`.
# LOT 4-PROD - historical Supabase storage migration preparation

Status: code and simulated validation prepared; production writes not
authorized. Deployment remains NO-GO.

- The read-only snapshot audit used only `PROD_SNAPSHOT_DATABASE_URL`.
- Snapshot schema is older than secure-storage metadata: zero storage metadata
  columns are present.
- Aggregate inventory: 2 avatar references, 0 teacher documents and 0
  attendance attachments.
- Both avatar references are distinct public Supabase object URLs in
  `gestschool-avatars`, use the historical tenant prefix and belong to the
  expected database tenant.
- No parent-resource, uploader or cross-tenant inconsistency was found.
- Physical object existence and bucket-only orphans were not checked because no
  service-role access was available. No real Supabase request was made.
- Added a dry-run-first migration engine with deterministic canonical keys,
  SHA-256/size verification, approved-manifest gating, journal replay,
  conditional metadata writes and compensation after database failure.
- Apply is blocked until LOT 1C has migrated the active PostgreSQL row to the
  canonical tenant, preventing a legacy-tenant row from referencing a
  canonical storage key that the runtime would reject.
- Added an operational runbook at
  `docs/runbooks/storage-historical-migration.md`.
- The tool never deletes legacy sources and never rewrites audit/outbox payloads
  or historical URL columns.
- Final read-only dry-run: 2 records, 2 `source-read-disabled`, 0 missing,
  0 orphan and 0 error. The aggregate report checksum remained stable across
  repeated runs.
- Simulated migration tests: 14 migration-engine tests and 8 existing storage
  policy tests passed. They cover dry-run, replay, missing source, existing
  object, upload failure, database failure, signed-URL failure, compensation,
  failed compensation, tenant isolation, stale journal handling and secret-free
  journaling.
- Full API unit suite: 21 suites and 112 tests passed.
- Prisma validate/generate, API typecheck, lint, build, migration-script
  typecheck/lint and `git diff --check` passed.
- Production remains NO-GO until private bucket flags and object existence have
  been verified with backend-only service-role access, the full dry-run and
  object reconciliation pass on staging, and backup/restore evidence is
  approved.
