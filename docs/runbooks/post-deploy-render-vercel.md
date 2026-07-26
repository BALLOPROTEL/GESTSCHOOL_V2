# Verification post-deploiement Render et Vercel

Executer apres une promotion controlee.

## API

```bash
curl -fsS https://<api>/api/v1/health/live
curl -fsS https://<api>/api/v1/health/ready
curl -fsS -H "Authorization: Bearer $MONITORING_METRICS_TOKEN" \
  https://<api>/api/v1/monitoring/providers
```

- liveness et readiness sont HTTP 200 ;
- Redis est `up`, jamais `disabled` en production ;
- le stockage annonce Supabase sans exposer de secret ;
- les buckets sont prives et les URLs signees courtes ;
- `OUTBOX_IN_PROCESS_ENABLED=false` et
  `NOTIFICATIONS_WORKER_ENABLED=false` sur l'API.

## Worker

- `/health/live` et `/health/ready` sont HTTP 200 sur le reseau prive ;
- `GESTSCHOOL_PROCESS_ROLE=worker` ;
- `NOTIFICATIONS_WORKER_ENABLED=true` ;
- `OUTBOX_IN_PROCESS_ENABLED=false` ;
- backlog et lag diminuent ou restent nuls ;
- aucun provider reel n'est active sans recette LOT 5B.

## Frontend

- `VITE_API_BASE_URL` correspond a l'environnement ;
- aucune requete `/api/v1` n'est envoyee a l'origine Vercel ;
- les quatre feature flags provisoires restent desactives sauf validation ;
- login, dashboard, eleves, inscriptions, finance et notes fonctionnent ;
- audit console/reseau sans erreur inattendue.

## Echec et rollback

Arreter d'abord le worker. Revenir aux digests API/worker precedents et au
deploiement Vercel sain. Ne pas tenter un rollback SQL manuel. Si le schema est
incompatible, restaurer la sauvegarde vers une base separee selon
`docs/runbooks/backup-restore.md`.
