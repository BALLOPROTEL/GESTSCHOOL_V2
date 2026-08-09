# LOT R1 - Fondations responsive

Date de validation : 2026-08-09

## Verdict

GO pour le LOT R1. Les primitives globales disposent maintenant de zones responsive stables, le mode tablette utilise un rail dedie et le desktop valide a partir de 1280 px est preserve pixel pour pixel. Aucun composant metier n'a ete refondu dans ce lot.

## Causes racines confirmees

- Le shell basculait entre des seuils contradictoires (`760/761`, `900`, `980`, `1100/1101`) definis dans plusieurs feuilles.
- Entre 761 et 1100 px, une sidebar desktop complete etait comprimee dans un espace tablette.
- Plusieurs couches masquaient les debordements au niveau de `html`, `body`, `#root` ou de la page avec `overflow-x: clip/hidden`.
- Les gutters, hauteurs, largeurs du shell, cibles tactiles et z-index avaient plusieurs sources de verite.
- Les titres du rail tablette etaient encore forces par des selecteurs de theme plus specifiques.

## Breakpoints du shell

Avant : seuil global brutal autour de `760/761 px`, avec des variantes concurrentes a `900`, `980` et `1100/1101 px`.

Apres :

| Zone | Comportement du shell |
| --- | --- |
| `<480` | Petit mobile, pleine largeur, gutter 12 px, aucun shell desktop |
| `480-767` | Mobile, pleine largeur, gutter 16 px, drawer existant |
| `768-1023` | Rail tablette de 76 px, contenu et header scrolles localement |
| `1024-1279` | Sidebar compacte de 224 px et contenu respirable |
| `>=1280` | Desktop existant, sidebar 256 px et rendu inchange |

Les media queries metier non liees au shell sont volontairement conservees pour les lots R2 a R6.

## Tokens centralises

La feuille `responsive-foundation.css` porte desormais :

- largeur maximale du contenu ;
- gutters inline/block et quatre espacements structurels ;
- cible tactile de 44 px ;
- hauteurs de header ;
- largeurs sidebar et rail ;
- safe areas sur les quatre axes ;
- tailles fixes par zone pour les titres de page et de section ;
- z-index du sidebar, header, backdrop, drawer et popover ;
- aliases temporaires pour les anciennes variables du shell.

Les espacements directionnels du shell utilisent des proprietes logiques et restent compatibles RTL.

## Nettoyage CSS limite

- Suppression des masquages horizontaux globaux sur le document et la page.
- Conservation des scrolls horizontaux locaux necessaires aux composants ; les tables restent hors perimetre R1.
- Remplacement des seuils globaux `1100/1101` et `760` par les frontieres canoniques lorsqu'ils pilotaient le shell.
- Suppression du faux mode tablette qui comprimait la sidebar desktop.
- Correction de la cascade des titres et du profil dans le rail tablette.
- Aucun fichier CSS ajoute et aucune nouvelle dependance.

## Metriques avant/apres

| Mesure | Avant | Apres |
| --- | ---: | ---: |
| Fichiers CSS | 25 | 25 |
| Lignes CSS | 24 775 | 24 869 |
| Media queries | 124 | 129 |
| `!important` | 1 196 | 1 191 |
| CSS principal compile | 442,62 kB | 446,15 kB |
| CSS principal gzip | 68,35 kB | 68,79 kB |

Le diff contient 35 lignes `!important` ajoutees et 40 retirees, dues au deplacement/retargetage de declarations existantes dans le bloc tablette. Aucun nouveau besoin de priorite n'a ete introduit ; le solde est de `-5`.

Le JavaScript applicatif est inchange : seules les feuilles globales, le test statique et le runner visuel ont ete modifies.

## Validation multi-ecrans

L'audit Playwright officiel mocke a valide 148 workflows sur 148, avec zero constat et une allowlist vide.

| Viewport | Resultat |
| --- | --- |
| 320x568 | PASS |
| 360x800 | PASS |
| 375x812 | PASS |
| 390x844 | PASS, clair/sombre |
| 412x915 | PASS, echantillon AR RTL |
| 768x1024 | PASS, rail tablette |
| 820x1180 | PASS, clair/sombre |
| 1024x1366 | PASS, sidebar compacte |
| 1280x720 | PASS, identique avant/apres |
| 1440x900 | PASS, identique avant/apres |

Les frontieres exactes `767/768`, `1023/1024` et `1279/1280`, le paysage tablette et le zoom 200 % sont egalement couverts. Aucun overflow document, erreur API imprevue, erreur console, `pageerror`, chargement bloque ou contenu indisponible n'a ete detecte.

Les captures desktop avant/apres ont des SHA-256 identiques :

- 1280x720 : `abf759f89efbb710997c1c82b6b76ba34f8343132cb8fb109e33fa4ddb6d5635`
- 1440x900 : `28867cb700365392cbf15c70baa6fc335230b59d694de3db252342ea702fc376`

## Validations techniques

- Test de contrat responsive : 5/5 PASS.
- Tests frontend complets : 26 fichiers, 131/131 PASS.
- Typecheck frontend : PASS.
- Lint frontend : PASS.
- Build frontend avec origines API/storage explicites : PASS.
- Smoke frontend : PASS.
- Audit visuel mocke CI : 73/73, zero constat.
- Audit visuel mocke complet : 148/148, zero constat.
- `git diff --check` : PASS.

## Dette volontairement reportee

- R2 : navigation mobile/tablette definitive et ergonomie du rail.
- R3 : dashboard et cartes metier.
- R4 : tables, colonnes, scrolls locaux et actions fixes.
- R5 : formulaires, filtres, modales, drawers et onglets.
- R6 : modules metier, graphiques et cas de contenu complexes.
- R7-R10 : finitions accessibilite, performance, audits integres et validation de release.
- Les media queries metier historiques et les 1 191 `!important` restants ne sont pas une cible de R1.

## Message de commit propose

`refactor(web-admin): establish responsive shell foundations`

Ce rapport ne cree ni commit, ni push, ni deploiement.
