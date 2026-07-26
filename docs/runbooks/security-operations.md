# Runbook secrets, incident cross-tenant et sessions

## Rotation d'un secret

**Symptomes** : expiration planifiee ou suspicion de fuite.
**Diagnostic** : identifier les services consommateurs sans afficher la valeur.
**Commandes sures** : generer dans le gestionnaire du fournisseur, mettre a jour
l'environnement protege, redeployer puis revoquer l'ancienne valeur.
**Escalade** : JWT, service-role Supabase, DB ou provider compromis.
**Rollback** : restaurer temporairement l'ancienne valeur uniquement si elle
n'est pas compromise.
**Retour normal** : probes, login, storage et provider checks valides ; ancienne
cle revoquee.

## Incident cross-tenant

**Symptomes** : utilisateur voyant une ressource d'un autre etablissement ou log
montrant un tenant incoherent.
**Diagnostic** : conserver correlation ID, user ID, tenant ID et endpoint ;
ne pas copier la donnee scolaire.
**Commandes sures** : passer l'API en maintenance/ecriture limitee, suspendre les
sessions concernees et interroger les journaux d'audit en lecture seule.
**Escalade** : immediate vers responsable securite et direction ; appliquer les
obligations de notification legales.
**Rollback** : revenir au digest sain, ne supprimer aucune preuve.
**Retour normal** : test d'isolation reproduit puis corrige, sessions revoquees,
audit des acces termine.

## Revocation generale des sessions

**Symptomes** : secret JWT compromis, vol massif de tokens ou changement IAM
critique.
**Diagnostic** : confirmer le perimetre et sauvegarder les journaux.
**Commandes sures** : rotation controlee du secret JWT et/ou invalidation de la
version de session via le mecanisme IAM existant ; ne jamais journaliser les
tokens.
**Escalade** : toute revocation globale, car tous les utilisateurs seront
deconnectes.
**Rollback** : pas de restauration d'un secret compromis ; informer et
accompagner les reconnexions.
**Retour normal** : anciens access/refresh tokens refuses, nouvelle connexion
reussie, compte desactive toujours bloque.
