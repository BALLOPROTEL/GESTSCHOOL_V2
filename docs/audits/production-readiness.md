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
