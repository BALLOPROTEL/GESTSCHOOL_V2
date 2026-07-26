# Migration canonique du tenant par defaut

Cette procedure prepare le remplacement du tenant historique
`00000000-0000-0000-0000-000000000001` par l'UUID versionne
`00000000-0000-4000-8000-000000000001`.

La migration Prisma associee est
`20260726120000_canonical_default_tenant_id`. Elle ne modifie que les colonnes
`tenant_id` des 42 tables attendues. Les payloads d'audit, les evenements outbox
traites et les URL de fichiers historiques restent inchanges.

## Preconditions

1. Planifier une fenetre de maintenance sans ecriture.
2. Arreter l'API et le worker avant la sauvegarde finale.
3. Creer une sauvegarde PostgreSQL chiffree et verifier son checksum.
4. Restaurer cette sauvegarde dans une base jetable et verifier sa lisibilite.
5. Executer le preflight LOT 1C sur la base courante en lecture seule.
6. Confirmer :
   - exactement 42 tables avec `tenant_id` ;
   - aucune valeur NULL ou inattendue ;
   - aucune ligne utilisant deja le tenant canonique ;
   - aucune relation parent/enfant inter-tenant ;
   - aucune contrainte PostgreSQL non validee.
7. Verifier que le role utilise par le job de migration peut executer les
   mises a jour malgre les politiques RLS.

Une collision ou une anomalie de preflight impose l'arret de l'operation. Il ne
faut ni fusionner ni supprimer automatiquement des donnees.

## Sequence de production

1. Garder l'API et le worker arretes.
2. Executer le job de migration controle avec `DIRECT_URL`.
3. Appliquer dans l'ordre les migrations 31 a 34 si elles sont absentes.
4. Appliquer `20260726120000_canonical_default_tenant_id`.
5. Configurer simultanement l'API et le worker avec :
   `DEFAULT_TENANT_ID=00000000-0000-4000-8000-000000000001`.
6. Deployer l'API, puis le worker.
7. Verifier les endpoints live/readiness, l'authentification, les sessions, le
   stockage prive, les notifications et l'isolation tenant.
8. Confirmer que les 42 tables ne contiennent plus le tenant historique.
9. Reouvrir les ecritures uniquement apres tous les smoke tests.

Les access tokens et refresh tokens existants portent l'ancien tenant. Ils
doivent etre revoques ou expires pendant la fenetre de maintenance afin
d'imposer une reconnexion apres le deploiement.

## Rollback

Avant la reprise des ecritures, une migration inverse transactionnelle peut
remplacer l'UUID canonique par l'ancien UUID uniquement si :

- aucune ligne historique ne subsiste ;
- aucune nouvelle ligne canonique n'a ete creee ;
- aucune valeur tenant inattendue ou NULL n'existe ;
- les memes 42 tables et relations sont toujours presentes.

Apres la reprise des ecritures, ce rollback global est interdit : les lignes
migrees ne peuvent plus etre distinguees des nouvelles lignes. Le rollback
consiste alors a restaurer la sauvegarde pre-migration et a redeployer ensemble
l'ancien code et l'ancienne configuration.

La reprise des ecritures constitue donc le point de non-retour de la migration
inverse simple.

## Donnees volontairement conservees

- payloads de `iam_audit_logs` ;
- payloads `outbox_events`, notamment ceux au statut `PROCESSED` ;
- anciennes valeurs `users.avatar_url`.

Les fichiers historiques sont traites separement dans le plan LOT 4-PROD.
