# Observabilite et alertes

## Signaux disponibles

L'API produit des logs JSON en production. Chaque requete contient un
`requestId` valide ou genere, methode, route normalisee sans query string, statut
et duree. Le tenant n'est journalise que sous forme d'UUID valide. Les logs ne
doivent contenir ni token, destinataire complet, contenu de notification,
document, mot de passe, cle Supabase ou cle fournisseur.

L'endpoint protege `/api/v1/monitoring/metrics` expose :

- uptime, heap et RSS ;
- debit, duree et statut HTTP par route normalisee ;
- disponibilite et statistiques Redis selectionnees ;
- disponibilite, connexions, transactions, rollbacks et deadlocks PostgreSQL ;
- backlog, lag, retries et dead-letter outbox/notifications ;
- operations et erreurs du stockage.

Le scrape utilise `Authorization: Bearer <MONITORING_METRICS_TOKEN>`. Le token
est monte comme secret dans Prometheus et ne figure pas dans le YAML.

## Seuils initiaux

| Alerte | Seuil | Escalade |
| --- | --- | --- |
| API indisponible | 2 minutes | immediat |
| PostgreSQL ou Redis indisponible | 1 minute | immediat |
| taux 5xx | > 5 % pendant 5 minutes et trafic present | equipe technique |
| outbox due | > 100 pendant 10 minutes | operateur worker |
| lag notification | > 15 minutes | operateur worker |
| dead-letter | > 0 pendant 5 minutes | analyse fonctionnelle/fournisseur |
| erreurs stockage | augmentation sur 10 minutes | operateur Supabase |

Ces seuils sont des points de depart. Ils doivent etre ajustes apres deux
semaines de metriques reelles, sans masquer les incidents.

## Collecte

Prometheus auto-heberge est fourni pour un environnement Docker. Render peut
necessiter un collecteur externe ou une integration native. Aucun fournisseur
payant n'est impose par ce lot. Sans collecteur et canal d'alerte, la presence de
metriques seule ne constitue pas une observabilite de production.
