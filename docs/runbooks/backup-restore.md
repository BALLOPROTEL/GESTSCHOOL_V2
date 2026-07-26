# Runbook sauvegarde et restauration

## Objectifs

- RPO initial propose : 24 heures maximum, a reduire selon le plan PostgreSQL.
- RTO initial propose : 4 heures pour restaurer, valider et repointer.
- Une sauvegarde n'est validee qu'apres une restauration reussie.

## Sauvegarde PostgreSQL

**Symptomes justifiant l'operation** : calendrier automatique ou avant migration.
**Diagnostic** : verifier espace, version `pg_dump`, chiffrement et retention.
**Commande sure** :

```bash
GESTSCHOOL_BACKUP_ENVIRONMENT=production \
BACKUP_DATABASE_URL="$DATABASE_URL" \
BACKUP_DIR=/var/backups/gestschool \
BACKUP_ENCRYPTION_RECIPIENT="<age-recipient>" \
BACKUP_RETENTION_DAYS=30 \
Infrastructure/scripts/backup-postgres.sh
```

Planifier cette commande dans un ordonnanceur approuve, stocker les archives
chiffrees hors de l'instance et superviser son code retour.
**Escalade** : echec, checksum absent, espace insuffisant ou archive non
restaurable.
**Rollback** : conserver la derniere archive valide ; ne jamais ecraser une
sauvegarde.
**Retour normal** : archive, manifeste et SHA-256 presents, copie hors site
confirmee.

## Restauration jetable

**Symptomes** : exercice mensuel ou reprise apres incident.
**Diagnostic** : verifier checksum, cle age et base cible jetable.
**Commande sure** :

```bash
RESTORE_DATABASE_URL="$RESTORE_URL" \
RESTORE_CONFIRM_DATABASE=gestschool_restore_check \
BACKUP_AGE_IDENTITY_FILE=/run/secrets/gestschool-backup-age-key \
Infrastructure/scripts/restore-postgres.sh /var/backups/gestschool/<archive>.dump.age
```

Le script refuse les bases systeme et, par defaut, toute base sans suffixe de
test/restauration.
**Escalade** : checksum invalide, migration divergente, donnees critiques
absentes ou RTO depasse.
**Rollback** : supprimer uniquement la base jetable ; la source n'est jamais
modifiee.
**Retour normal** : `pg_restore`, requete de controle et `migrate status`
reussis, duree mesuree et preuve conservee.

## Supabase Storage

Avant toute migration :

1. exporter l'inventaire objets (bucket, chemin, taille, checksum/version) ;
2. exporter les metadonnees PostgreSQL correspondantes ;
3. comparer objets absents et orphelins en lecture seule ;
4. conserver les journaux de migration idempotents ;
5. verifier les options de sauvegarde/replication du plan Supabase.

Le LOT 9 ne configure pas de copie binaire automatique des buckets faute de
destination chiffree approuvee. Le deploiement reste NO-GO tant que cette
destination et la restauration representative ne sont pas validees.
