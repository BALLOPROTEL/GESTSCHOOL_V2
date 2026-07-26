# Architecture d'exploitation GestSchool

## Composants

| Composant | Configuration cible | Risque traite | Action utilisateur |
| --- | --- | --- | --- |
| GitHub Actions | gates qualite, visuel, securite et conteneurs, actions par SHA | release non testee, action mutable | proteger `main` et rendre `Required CI gate` obligatoire |
| Vercel | build frontend avec URL API explicite et flags par environnement | preview appelant la production | renseigner Preview et Production separement |
| Render API | service web sans tache de fond, auto-deploy desactive | double traitement, migration concurrente | choisir un plan sans mise en veille |
| Render worker | background worker dedie, un replica initial | backlog non traite ou double traitement | approuver le cout du plan Starter ou equivalent |
| PostgreSQL | migration manuelle unique, sauvegarde restauree avant migration | corruption ou rollback impossible | activer sauvegardes et environnement GitHub protege |
| Redis | meme region, `noeviction`, obligatoire | rate limiting incoherent | verifier URL privee, alertes et capacite |
| Supabase Storage | buckets documents/avatars prives, URLs signees courtes | fuite documentaire | verifier policies, sauvegarde et inventaire |
| Prometheus compatible | endpoint protege par bearer token | absence de signaux | choisir collecte Render/externe ou Prometheus auto-heberge |

## Images

`Backend/api/Dockerfile` produit trois cibles depuis Node 22.22.0 :

- `api` : dependances de production, utilisateur `node`, healthcheck ;
- `worker` : meme runtime minimal, healthcheck dedie ;
- `migration` : Prisma CLI et migrations, utilisateur `node`, execution unique.

Les builds utilisent un tag de commit, puis le deploiement doit referencer le
digest immuable. Les manifestes Kubernetes contiennent un digest nul
fail-closed que l'outil de release doit remplacer. Aucun tag `latest` n'est une
cible de deploiement.

## Frontieres operationnelles

- L'API refuse de demarrer avec un mode de fond actif.
- Le worker refuse de demarrer sans mode worker actif.
- Readiness exige PostgreSQL et Redis.
- Liveness indique uniquement que le processus repond.
- Une migration echouee bloque la promotion de l'API et du worker.
- Une panne Redis retire API et worker de la rotation sans contourner le rate
  limiting.
- Aucun provider payant n'est appele par la CI.

## Decisions externes encore requises

1. plan Render API sans mise en veille ;
2. plan Render background worker ;
3. solution de collecte/alerte des metriques ;
4. plan PostgreSQL/Supabase avec sauvegardes automatiques et PITR adaptes au RPO ;
5. stockage chiffre hors site des exports PostgreSQL ;
6. activation Brevo reservee au LOT 5B.
