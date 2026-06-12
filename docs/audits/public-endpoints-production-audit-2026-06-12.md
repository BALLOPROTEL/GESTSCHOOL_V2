# Audit endpoints publics production - 2026-06-12

## Perimetre

Audit statique des routes marquees `@Public()` dans `Backend/api/src`, avec verification des garde-fous applicatifs visibles dans le code.

## Endpoints publics identifies

| Surface | Routes | Protections presentes | Etat |
| --- | --- | --- | --- |
| Health | `GET /health`, `/health/live`, `/health/ready` | `@RateLimit`, readiness sans detail sensible | OK apres durcissement |
| Auth | login, refresh, logout, forgot/reset password, activation, first connection | `@RateLimit`, DTO validation, politique mot de passe cote service | OK |
| Monitoring | `GET /monitoring/metrics`, `/monitoring/providers` | token obligatoire en production, rejet secrets faibles, `@RateLimit`, sortie sans secret brut | OK, teste unitairement |
| Paiement PayDunya | `POST/GET /payments/paydunya/callback` | `@RateLimit`, extraction payload, verification hash cote provider/service | OK, a surveiller en recette fournisseur |
| Notifications provider | `POST /notifications/delivery-events` | secret webhook obligatoire, rejet secrets faibles en production, comparaison constante, `@RateLimit` | OK |

## Correctifs appliques

- Ajout de `@RateLimit` aux routes health publiques.
- Ajout de tests unitaires sur :
  - blocage de `FILE_STORAGE_DRIVER=LOCAL` en production ;
  - bascule avatar vers Supabase quand la configuration runtime existe ;
  - verrouillage monitoring public en production ;
  - absence d'exposition des valeurs secretes dans `/monitoring/providers`.
- Ajout du job CI `test:unit` pour executer ces garde-fous a chaque push.

## Risques residuels

- Les callbacks PayDunya dependent encore d'une recette bout-en-bout avec payload fournisseur reel/sandbox pour confirmer les variantes de hash et de statut.
- `/health/ready` effectue une verification database/Redis : la limite applicative est presente, mais le reverse proxy doit aussi conserver une limitation raisonnable.
- Les endpoints publics doivent rester derriere HTTPS et logs sans body sensible en production.

## Recommandations prochain lot

1. Ajouter une recette sandbox PayDunya avec callback valide et callback hash invalide.
2. Ajouter un test e2e notification delivery event avec secret faible en production simulee.
3. Ajouter une checklist Render/Vercel : `MONITORING_METRICS_TOKEN`, `NOTIFICATION_WEBHOOK_SECRET`, `FILE_STORAGE_DRIVER=SUPABASE`, buckets Supabase et URLs callback paiement.
