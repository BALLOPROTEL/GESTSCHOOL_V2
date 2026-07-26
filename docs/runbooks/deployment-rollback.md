# Runbook deploiement, migration et rollback

## Deploiement

**Symptomes justifiant l'operation** : release approuvee, CI verte, migration et
restauration testees.
**Diagnostic** : verifier `Required CI gate`, SHA, SBOM/scans, sauvegarde et
inventaire Storage.
**Commandes sures** :

```bash
git show --stat <sha>
pnpm --filter @gestschool/api db:status
curl -fsS https://<api>/api/v1/health/live
curl -fsS https://<api>/api/v1/health/ready
```

Executer le workflow manuel `Controlled production migration`, puis promouvoir
API, worker et frontend dans cet ordre.
**Escalade** : toute migration en attente inattendue, doublon, readiness rouge,
scan critique/haut ou sauvegarde non restauree.
**Rollback** : arreter le worker, repasser aux digests precedents, restaurer dans
une base separee si le schema est incompatible.
**Retour normal** : API et worker ready, smoke authentifie reussi, backlog stable,
aucun pic 5xx.

## Migration

**Symptomes** : nouveau code exigeant un schema additif valide.
**Diagnostic** : executer l'audit precutover sur une copie representative et
`migrate status`.
**Commandes sures** :

```bash
pnpm --filter @gestschool/api audit:precutover -- --out=/tmp/precutover.json
pnpm --filter @gestschool/api db:status
pnpm render:migrate:api
```

La derniere commande est reservee au job protege et ne s'execute qu'une fois.
**Escalade** : doublon, verrou long, migration divergente ou backup sans preuve
de restauration.
**Rollback** : ne pas inverser le SQL a chaud ; restaurer la sauvegarde vers une
nouvelle base puis repointer.
**Retour normal** : `migrate status` a jour, contraintes presentes, E2E/smoke
post-migration reussis.

## Rollback applicatif

**Symptomes** : erreurs 5xx, corruption fonctionnelle, worker instable apres
promotion.
**Diagnostic** : correlation ID, metriques, diff de variables et compatibilite
du schema.
**Commandes sures** : consulter les logs par request ID et revalider les probes ;
ne jamais afficher les secrets.
**Escalade** : incident cross-tenant, perte de donnees ou restauration requise.
**Rollback** : worker d'abord, API ensuite, frontend en dernier ; utiliser les
digests immuables precedents.
**Retour normal** : probes vertes, erreur arretee, files stables, utilisateurs
tests reconnectes.
