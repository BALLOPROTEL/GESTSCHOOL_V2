# Matrice des variables d'environnement

Les valeurs entre chevrons sont des placeholders. Aucun secret reel ne doit etre
stocke dans Git.

| Variable | API | Worker | Frontend | Secret | Defaut sur | Obligatoire en production |
| --- | --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | oui | oui | build | non | aucun | `production` |
| `GESTSCHOOL_PROCESS_ROLE` | `api` | `worker` | non | non | aucun | oui |
| `DATABASE_URL` | oui | oui | non | oui | aucun | oui, runtime/pooler |
| `DIRECT_URL` | migration | migration | non | oui | aucun | oui, direct/session |
| `REDIS_URL` | oui | oui | non | oui | aucun | oui |
| `REDIS_KEY_PREFIX` | oui | oui | non | non | `gestschool` | recommande |
| `TRUST_PROXY_HOPS` | oui | non | non | non | aucun | oui, `1` sur Render |
| `RATE_LIMIT_DISABLED` | oui | non | non | non | `false` | doit rester `false` |
| `CORS_ORIGINS` | oui | non | non | non | aucun | oui, origines HTTPS |
| `JWT_ISSUER` / `JWT_AUDIENCE` | oui | oui | non | non | aucun | oui |
| `JWT_SECRET` | oui | oui | non | oui | aucun | oui, >= 32 caracteres |
| `PASSWORD_RESET_SECRET` | oui | non | non | oui | aucun | oui |
| `DEFAULT_TENANT_ID` | oui | oui | non | non | aucun | oui |
| `SWAGGER_ENABLED` | oui | non | non | non | `false` | doit rester `false` |
| `MONITORING_METRICS_TOKEN` | oui | scrape | non | oui | aucun | oui |
| `WORKER_HEALTH_HOST` | non | oui | non | non | `0.0.0.0` | oui |
| `WORKER_HEALTH_PORT` | non | oui | non | non | `3001` | oui |
| `NOTIFICATIONS_WORKER_ENABLED` | `false` | `true` | non | non | `false` | oui |
| `OUTBOX_IN_PROCESS_ENABLED` | `false` cible ; `true` bac a sable vide | `false` | non | non | `false` | worker dedie cible ; exception temporaire strictement gardee |
| `ALLOW_IN_PROCESS_OUTBOX_FOR_EMPTY_SANDBOX` | bac a sable seulement | non | non | non | `false` | `true` uniquement avec une API mono-instance sans canal/provider reel |
| `WEB_CONCURRENCY` | oui | non | non | non | plateforme | `1` obligatoire pour l'exception bac a sable |
| `OUTBOX_*` | non | oui | non | non | valeurs documentees | oui |
| `NOTIFICATIONS_EMAIL_PROVIDER` | oui pour auth synchrone | oui | non | non | `MOCK` | explicite ; `BREVO` seulement apres recette |
| `NOTIFICATIONS_SMS_PROVIDER` | `MOCK` | oui | non | non | `MOCK` | worker uniquement |
| `NOTIFICATION_WEBHOOK_SIGNING_SECRET` | non | oui | non | oui | aucun | oui si worker actif |
| `BREVO_API_KEY` | si email auth Brevo | si provider Brevo | jamais | oui | aucun | seulement apres activation |
| `BREVO_SENDER_EMAIL` | si email auth Brevo | si email Brevo | non | non | aucun | adresse verifiee |
| `BREVO_SENDER_NAME` | si email auth Brevo | si email Brevo | non | non | `GestSchool` | recommande |
| `BREVO_TIMEOUT_MS` | si Brevo | si Brevo | non | non | `8000` | 1000 a 120000 |
| `BREVO_SMS_SENDER` | non | si SMS reel | non | non | `GestSchool` | avant SMS reel |
| `BREVO_SMS_DRY_RUN` | non | oui | non | non | `true` | conserver `true` avant recette SMS |
| `ALLOW_REAL_SMS` | non | oui | non | non | `false` | conserver `false` avant recette SMS |
| `BREVO_WEBHOOK_ENABLED` | oui | non | non | non | `false` | `true` apres configuration Brevo |
| `BREVO_WEBHOOK_AUTH_TOKEN` | oui si webhook | non | jamais | oui | aucun | secret Bearer fort |
| `BREVO_WEBHOOK_MAX_AGE_SECONDS` | oui si webhook | non | non | non | `90000` | 24 h de retries Brevo + 1 h de marge ; plage production 86400 a 90000 |
| `FILE_STORAGE_DRIVER` | oui | non | non | non | aucun | `SUPABASE` |
| `STORAGE_PROVIDER` | oui | non | non | non | derive du driver | `supabase` |
| `SUPABASE_URL` | oui | non | non | non | aucun | oui |
| `SUPABASE_SERVICE_ROLE_KEY` | oui | non | jamais | oui | aucun | oui |
| `SUPABASE_STORAGE_BUCKET_DOCUMENTS` | oui | non | non | non | aucun | oui, prive |
| `SUPABASE_STORAGE_BUCKET_AVATARS` | oui | non | non | non | aucun | oui, prive |
| `SUPABASE_STORAGE_AVATARS_PUBLIC` | oui | non | non | non | `false` | doit rester `false` |
| `SUPABASE_STORAGE_SIGNED_URL_TTL_SECONDS` | oui | non | non | non | `300` | 60 a 900 |
| `PAYMENT_PROVIDER` / `PAYDUNYA_*` | oui | non | non | cles oui | `mock` local | selon activation |
| `VITE_API_BASE_URL` | non | non | oui | non | aucun hors dev/test | oui, HTTPS |
| `VITE_FEATURE_MESSAGES` | non | non | oui | non | `false` | explicite |
| `VITE_FEATURE_MOSQUEE` | non | non | oui | non | `false` | explicite |
| `VITE_FEATURE_STUDENT_PORTAL` | non | non | oui | non | `false` | explicite |
| `VITE_FEATURE_USER_BILLING` | non | non | oui | non | `false` | explicite |

Les secrets API/worker sont separes des variables Vercel. La cle service-role
Supabase, les secrets JWT, Brevo, PayDunya et monitoring ne doivent jamais
apparaitre dans un bundle frontend.

## Exception temporaire : environnement actuel vide

L'environnement non utilise peut traiter l'outbox dans l'unique processus API
sans worker payant uniquement lorsque toutes les conditions suivantes sont
vraies :

- `GESTSCHOOL_RUNTIME_ENV=production` et `GESTSCHOOL_PROCESS_ROLE=api` ;
- `OUTBOX_IN_PROCESS_ENABLED=true` et
  `ALLOW_IN_PROCESS_OUTBOX_FOR_EMPTY_SANDBOX=true` ;
- `WEB_CONCURRENCY=1` et `NOTIFICATIONS_WORKER_ENABLED=false` ;
- les canaux email/SMS sont desactives et leurs providers restent `MOCK` ;
- webhook Brevo et SMS reel sont desactives ;
- `PAYMENT_PROVIDER=mock`.

Le validateur et les services runtime refusent toute combinaison plus large.
Cette exception doit etre retiree avant la creation du premier compte reel,
l'activation d'un provider externe ou le passage a plusieurs instances.
