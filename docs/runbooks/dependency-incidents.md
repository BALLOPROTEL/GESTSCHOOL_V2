# Runbook pannes PostgreSQL, Redis et Supabase

## PostgreSQL

**Symptomes** : readiness 503, timeouts Prisma, hausse des rollbacks ou
connexions.
**Diagnostic** :

```sql
SELECT now(), count(*) FROM pg_stat_activity;
SELECT datname, xact_rollback, deadlocks FROM pg_stat_database;
```

Utiliser une connexion operateur separee sans imprimer l'URL.
**Escalade** : indisponibilite > 5 minutes, deadlocks persistants, saturation ou
integrite suspecte.
**Rollback** : suspendre worker/ecritures ; basculer vers une instance saine ou
une restauration validee, jamais modifier les migrations appliquees.
**Retour normal** : requete `SELECT 1`, readiness API/worker et smoke transactionnel
reussis.

## Redis

**Symptomes** : readiness 503, rate limiting indisponible, worker non ready.
**Diagnostic** :

```bash
redis-cli -u "$REDIS_URL" PING
redis-cli -u "$REDIS_URL" INFO memory
```

Ne pas copier l'URL dans un ticket. Verifier `noeviction`, region et memoire.
**Escalade** : panne > 2 minutes, eviction ou erreurs d'authentification.
**Rollback** : restaurer le service Redis/configuration precedente ; ne pas
desactiver le rate limiting et ne pas activer le fallback memoire.
**Retour normal** : PONG, readiness verte et compteurs a nouveau operationnels.

## Supabase Storage

**Symptomes** : upload/read/delete en erreur ou divergence objet/metadonnees.
**Diagnostic** : endpoint provider protege, metriques storage, audit des buckets
prives et inventaire lecture seule.
**Commandes sures** : utiliser le script d'inventaire futur en dry-run ; ne
jamais lister la cle service-role.
**Escalade** : bucket public, acces cross-tenant, objets perdus ou compensation
echouee.
**Rollback** : suspendre les uploads, restaurer la cle/policy precedente,
reconcilier uniquement depuis un journal idempotent.
**Retour normal** : upload, URL signee courte, lecture et suppression reussis ;
zero objet absent/orphelin non explique.
