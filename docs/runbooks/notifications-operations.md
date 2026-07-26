# Runbook outbox, backlog et dead-letter

## Backlog outbox

**Symptomes** : `outbox_due > 100`, lag > 15 minutes, notifications retardees.
**Diagnostic** : verifier readiness worker, Redis/PostgreSQL, lease expiree et
reponses fournisseur, sans afficher destinataire ou contenu.
**Commandes sures** : consulter les metriques et compter les statuts dans une
session SQL en lecture seule.
**Escalade** : croissance continue 10 minutes, lease non recuperee ou fournisseur
indisponible.
**Rollback** : arreter le worker fautif et redeployer son digest precedent ; ne
pas activer l'outbox dans l'API.
**Retour normal** : backlog decroissant, lag sous seuil, aucune double livraison
locale.

## Notifications dead-letter

**Symptomes** : statut `DEAD_LETTER` ou alerte dediee.
**Diagnostic** : classer erreur permanente, timeout inconnu, configuration ou
donnee invalide ; verifier les tentatives auditees.
**Commandes sures** : utiliser uniquement l'endpoint de replay admin audite apres
correction de cause ; ne jamais modifier le statut directement en SQL.
**Escalade** : incident massif, reponse fournisseur inconnue ou risque de doublon.
**Rollback** : annuler la campagne si possible, conserver le journal et ne pas
effacer les tentatives.
**Retour normal** : replay unique reussi ou annulation documentee, backlog stable.

La garantie reste **au moins une fois avec deduplication locale**, completee par
l'idempotence fournisseur lorsqu'elle existe. Ce runbook ne promet pas exactly
once.
