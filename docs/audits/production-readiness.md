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
