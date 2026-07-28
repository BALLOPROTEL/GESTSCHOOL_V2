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

## Brevo indisponible ou callbacks absents

**Symptomes** : HTTP 408/429/5xx, timeout, notifications retryables, message
accepte sans callback ou callback refuse.
**Diagnostic** : verifier les metriques et les identifiants techniques
fournisseur, l'etat du sender via la commande de verification et la
configuration Bearer du webhook. Ne jamais afficher destinataire, contenu ou
cle API.
**Commandes sures** : utiliser
`pnpm --filter @gestschool/api notifications:verify:brevo-sender` uniquement
avec l'environnement serveur ; cette commande ne transmet aucun message.
**Escalade** : timeout au resultat inconnu, hausse des 429, callbacks absents ou
SMS potentiellement accepte sans reponse.
**Rollback** : remettre le provider concerne sur `MOCK`, conserver le worker
separe et ne pas rejouer aveuglement les SMS a resultat inconnu.
**Retour normal** : sender actif, callback authentifie/deduplique, backlog
decroissant et aucune nouvelle dead-letter.

Brevo n'offre pas de signature HMAC native documentee pour ces callbacks.
GestSchool utilise le Bearer configure sur le webhook, une date bornee et la
deduplication transactionnelle. L'idempotence Brevo documentee est limitee aux
emails et a une fenetre courte ; aucun exactly-once n'est revendique.

Premiere recette staging, email uniquement :

```text
NOTIFICATIONS_EMAIL_PROVIDER=BREVO
NOTIFICATIONS_SMS_PROVIDER=MOCK
BREVO_SMS_DRY_RUN=true
ALLOW_REAL_SMS=false
BREVO_WEBHOOK_MAX_AGE_SECONDS=90000
```

Le jeton Bearer du webhook est distinct de `BREVO_API_KEY`. Brevo retente les
webhooks sortants pendant 24 heures ; la fenetre de 25 heures ajoute seulement
une heure de marge tout en conservant anti-rejeu et deduplication.
