# Audit visuel Web Admin

Ce runbook decrit le gate visuel strict de GestSchool. Il existe deux modes
explicites. Le mode ne peut pas etre omis et aucune erreur `/api/v1` n'est ignoree.

## Modes

### Mocked

```bash
VISUAL_AUDIT_URL=http://127.0.0.1:5180 \
VISUAL_AUDIT_OUTPUT=/tmp/gestschool-visual-mocked \
pnpm visual:audit:mocked
```

- Les fixtures versionnees sont dans
  `scripts/visual-audit/fixtures/mock-api-v1.mjs`.
- Chaque couple methode/route est declare explicitement. Il n'existe aucune
  interception generique `/api/v1/**`.
- Toute requete API non declaree est bloquante et apparait comme
  `unmocked-api-request` dans le rapport.
- Les fixtures ne contiennent ni secret ni donnee personnelle reelle.

Le perimetre complet couvre les workflows d'authentification et les modules
Tableau de bord, Eleves, Enseignants, Utilisateurs et droits, Inscriptions,
Comptabilite, Notes et bulletins, Absences, Salles, Emploi du temps,
Notifications, Referentiel, Pilotage, Parents et Rapports. Les variantes couvrent
mobile etroit/large, tablette portrait/paysage, desktop/large desktop, zoom 200%,
clair/sombre et FR/EN/AR avec controle RTL.

La CI utilise `VISUAL_AUDIT_SCOPE=ci`. Ce perimetre est reduit en nombre de
combinaisons, mais conserve tous les workflows, des controles mobile/tablette,
les cinq ecrans critiques et les langues EN/AR.

### Integrated

```bash
VISUAL_AUDIT_USERNAME='<compte de test>' \
VISUAL_AUDIT_PASSWORD='<secret de test>' \
VISUAL_AUDIT_URL=http://127.0.0.1:5180 \
VISUAL_AUDIT_OUTPUT=/tmp/gestschool-visual-integrated \
pnpm visual:audit:integrated
```

Ce mode exige une API reelle, une base PostgreSQL de test migree, Redis lorsque
l'API l'exige et un compte deterministe. Il n'intercepte aucune route metier. Ne
jamais l'executer avec des donnees client reelles destinees aux captures.

## Conditions bloquantes

Le collecteur `scripts/visual-audit/lib/audit-guard.mjs` fait echouer l'audit sur :

- reponse API 4xx/5xx inattendue ;
- requete API non mockee en mode mocked ;
- `requestfailed`, erreur console, assertion console ou `pageerror` ;
- page vide, capture anormalement petite ou selecteur critique absent ;
- chargement encore visible ou indisponibilite inattendue ;
- debordement horizontal superieur a 4 px ;
- action primaire hors ecran ;
- contenu critique absent, texte critique non traduit, RTL ou focus visible
  incorrect.

Les captures attendent les polices et deux frames de rendu, masquent le caret et
desactivent les animations. Le contexte fixe la locale et le fuseau
`Europe/Paris`. Aucun delai arbitraire n'est utilise par le runner central.

## Allowlist

L'allowlist est vide par defaut. Une exception doit contenir exactement : type,
route, expression reguliere du message, raison, date d'expiration et ticket. Une
exception incomplete ou expiree fait echouer le demarrage. Une exception precise
ne masque jamais une autre erreur du meme ecran. Les erreurs API generiques et les
motifs globaux sont interdits.

## Rapports et traces

Chaque execution cree un repertoire date avec :

- `report.json` : mode, statut, workflow, route, viewport, theme, langue,
  constat, capture, requetes mockees et allowlist ;
- une capture par variante ;
- une trace Playwright pour chaque workflow en echec.

La CI conserve le repertoire `/tmp/gestschool-ci-visual-audit` pendant 14 jours,
meme lorsque le gate echoue.

## Tests du mecanisme

```bash
pnpm visual:audit:lint
pnpm visual:audit:test
```

Les tests prouvent le blocage d'une API 500, d'une API non mockee, d'une erreur
console, d'un `pageerror`, d'un chargement bloque, d'un overflow et d'un selecteur
critique absent. Ils prouvent aussi qu'une allowlist precise ne masque pas une
autre erreur.

## Inventaire des scripts historiques

| Scripts | Etat | Usage |
| --- | --- | --- |
| `scripts/visual-audit-core-workflows.mjs` | Gate central strict | CI et audits complets mocked/integrated |
| `scripts/visual-audit/lib/*` | Actif | Collecteur et tests du mecanisme |
| `Frontend/web-admin/scripts/smoke-tests.mjs` | Actif | Smoke statique de structure, distinct du visuel |
| `Frontend/web-admin/scripts/auth-iam-visual-audit.mjs` | Legacy | Ancienne recette authentification/IAM |
| `Frontend/web-admin/scripts/auth-visual-audit.mjs` | Legacy | Ancienne recette authentification |
| `Frontend/web-admin/scripts/dashboard-visual-audit.mjs` | Legacy | Ancienne recette tableau de bord |
| `Frontend/web-admin/scripts/enrollments-visual-audit.mjs` | Legacy | Ancienne recette inscriptions |
| `Frontend/web-admin/scripts/finance-visual-audit.mjs` | Legacy | Ancienne recette comptabilite |
| `Frontend/web-admin/scripts/iam-visual-audit.mjs` | Legacy | Ancienne recette IAM |
| `Frontend/web-admin/scripts/parents-visual-audit.mjs` | Legacy | Ancienne recette parents |
| `Frontend/web-admin/scripts/rooms-visual-audit.mjs` | Legacy | Ancienne recette salles |
| `Frontend/web-admin/scripts/students-visual-audit.mjs` | Legacy | Ancienne recette eleves |
| `Frontend/web-admin/scripts/teachers-visual-audit.mjs` | Legacy | Ancienne recette enseignants |
| `Frontend/web-admin/scripts/visual-audit.mjs` | Legacy | Ancien audit multi-ecrans |
| `scripts/visual-audit-notes-bulletins.mjs` | Legacy | Ancienne recette notes/bulletins |
| `scripts/visual-audit-profile.mjs` | Legacy | Ancienne recette profil |

Ces 13 scripts historiques restent disponibles pour comparer des ecrans
specialises, mais ils ne sont appeles ni par la CI ni par les scripts de release
et ne constituent pas une preuve de release. Le nombre de 14 mentionne dans le
brief LOT 8A n'est pas retrouve dans l'arbre courant : aucun quatorzieme script
ne doit etre invente. Leur suppression ou migration releve du LOT 8D.

## Resultat de reference du LOT 7

- Mode integrated, PostgreSQL 16 dedie et Redis ephemere : 15 workflows, 15
  captures, aucun constat.
- Mode mocked complet : 121 workflows, 121 captures, 117 succes et 4 echecs.
- Dettes exposees, non allowlistees : textes critiques du tableau de bord encore
  en francais en EN/AR et titre de liste des inscriptions encore en francais en
  EN/AR.

Le gate est donc fiable, mais la recette mocked globale reste rouge jusqu'a la
correction de ces traductions.
