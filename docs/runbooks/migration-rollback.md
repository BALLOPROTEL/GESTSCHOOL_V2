# Migration et rollback

Ce chemin historique est conserve pour les liens existants. La procedure
operationnelle canonique se trouve maintenant dans :

- `docs/runbooks/deployment-rollback.md` ;
- `docs/runbooks/backup-restore.md` ;
- `.github/workflows/production-migration.yml`.

Regles non negociables :

1. ne jamais migrer pendant le build ou le demarrage de l'API ;
2. ne jamais lancer la migration depuis plusieurs instances ;
3. sauvegarder puis restaurer sur une base jetable avant la migration ;
4. executer l'audit precutover sur une copie representative ;
5. utiliser le workflow manuel et l'environnement GitHub protege ;
6. arreter le worker avant une restauration ;
7. ne jamais annuler une ancienne migration a la main ;
8. conserver API et worker avec `OUTBOX_IN_PROCESS_ENABLED=false`.

Une collision, une sauvegarde non restauree ou une migration divergente impose
un NO-GO. La restauration s'effectue dans une base separee avant repointage.
