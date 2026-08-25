# LOT I8 - Refonte visuelle et accessibilite de l'assistant d'inscription

Date de validation locale : 2026-08-23

Perimetre : frontend GestSchool, assistant Admission I7, tests et runner visuel specialise.
Aucun fichier backend, contrat API, schema Prisma, migration, RBAC, regle metier ou
configuration de deploiement n'est modifie.

## A. Diagnostic initial

Le defaut principal du theme clair etait une collision de variables globales. Le fichier
`features.css`, charge apres les fondations, redefinit notamment `--panel` avec une surface
bleu nuit. L'assistant consommait directement `--panel` et `--ink-*` : ses cartes devenaient
donc sombres en theme clair, tandis que certains titres conservaient une couleur sombre.
Le resultat mesure etait une carte `rgb(15, 28, 40)` avec un titre `rgb(15, 23, 42)`.

Les autres defauts confirmes etaient une hierarchie faible du stepper, des etats actif et
termine insuffisamment distincts, des surfaces de choix peu explicites, des actions de danger
visuellement trop proches des actions neutres et une information d'etape moins lisible sur
petit ecran.

## B. Strategie visuelle

L'assistant declare des tokens semantiques locaux `--admission-*`, uniquement comme alias des
tokens fiables Premium V3 `--erp-*`. Ils couvrent surface, texte, bordure, accent, succes et
danger. Cette isolation evite la collision sans introduire un nouveau design system.

La largeur maximale passe de 74 a 68 rem. Les cartes, champs, textes secondaires, selections,
focus, erreurs et actions de danger utilisent des contrastes explicites dans les deux themes.
Les breakpoints existants 1023 et 767 sont conserves; aucun breakpoint ad hoc n'est ajoute.

## C. Stepper et navigation

La navigation native reste une liste ordonnee avec `aria-current="step"`. Un resume visuel
indique desormais `etape courante / 5` et son libelle, sans dupliquer l'information pour les
technologies d'assistance (`aria-hidden`). Les etats futur, actif et termine disposent de
surfaces et couleurs distinctes. La progression native et les proprietes logiques preservent
le RTL.

## D. Formulaires, choix et actions

Les champs ont une surface et une bordure coherentes avec le theme, ainsi qu'un focus visible
de 2 px avec offset. Les cartes selectionnees ne reposent pas uniquement sur la couleur : leur
bordure, leur surface et leur halo changent ensemble. Le groupe Finance expose desormais
explicitement `role="radiogroup"`; le choix Responsable conserve son groupe nomme.

Les annulations du wizard et des brouillons utilisent une action de danger dediee, tout en
conservant le dialogue de confirmation existant. Aucune suppression ou finalisation metier
n'est modifiee.

## E. Etats couverts

Le runner specialise couvre les neuf etats demandes : liste des brouillons, nouvel eleve,
reinscription, responsable vide, responsable renseigne, scolarite, finance, recapitulatif et
succes. Chaque etat est execute en clair et sombre aux formats 390x844, 820x1180 et 1440x900.
Responsable, Scolarite et Recapitulatif sont aussi verifies en arabe RTL.

La matrice represente 81 workflows. Elle verifie le debordement document, la direction RTL,
le contraste titre/carte, les cibles tactiles de 44 px, les erreurs navigateur et les appels
API inattendus. L'allowlist est vide.

## F. Accessibilite

- Navigation d'etapes : `nav`, liste ordonnee et `aria-current` conserves.
- Choix Finance : radiogroup nomme et radios natifs.
- Choix Responsable : groupe nomme existant confirme par test.
- Focus : contour visible sur champs, boutons, cartes et disclosure.
- Danger : libelle, bordure et surface, sans information transmise par la seule couleur.
- Tactile : aucune cible visible inferieure a 44 px dans les 81 workflows.
- RTL : direction arabe confirmee; les styles emploient les proprietes logiques.
- Mouvement : aucune animation indispensable n'est introduite.

## G. Themes et contrastes

Avant correction, le theme clair pouvait afficher un titre sombre sur une carte bleu nuit.
Apres correction, le contraste minimal titre/carte mesure sur la matrice est de 16,20:1.
Les themes clair et sombre utilisent les memes tokens semantiques, avec une valeur danger
specifique au theme sombre pour conserver la lisibilite.

## H. Responsive

Les viewports 390x844, 820x1180 et 1440x900 passent sans overflow document. Le wizard reste
en une colonne sur mobile, utilise une composition intermediaire sur tablette et une largeur
confortable mais bornee sur desktop. Les cartes et libelles acceptent le contenu variable
FR/EN/AR sans largeur fixe ajoutee.

## I. CSS avant/apres

| Mesure | Avant I8 | Apres I8 |
| --- | ---: | ---: |
| Lignes `admission-wizard.css` | 548 | 684 |
| Octets source | 10 400 | 15 268 |
| Octets gzip | 2 092 environ | 2 679 |
| `!important` | 0 | 0 |
| Breakpoints | 2 existants | 2 existants |

Le delta gzip est de 587 octets. Le budget local de l'assistant passe de 12 000 a 16 000
octets source; le budget CSS global et le plafond historique de `!important` restent
inchanges. Le build mesure le CSS principal a 469,55 KiB brut / 72,90 KiB gzip et le chunk
lazy Admission a 35,79 KiB brut / 9,03 KiB gzip.

## J. Tests et validations executees

- Tests cibles Admission : 24/24 PASS.
- Tests frontend complets : 43 fichiers, 245/245 PASS.
- Typecheck frontend : PASS.
- Lint frontend : PASS.
- Build avec origines CI explicites : PASS.
- Smoke frontend : PASS apres alignement du budget I8.
- CSP : 1/1 PASS.
- Tests du garde visuel : 6/6 PASS.
- Lint des scripts visuels : PASS.
- Budget performance : PASS.
- Parcours fonctionnels Admission I7 : 8/8 PASS, zero constat, zero appel imprevu,
  allowlist vide.
- Matrice visuelle Admission I8 : 81/81 PASS, zero constat, zero overflow, zero erreur
  navigateur ou API, allowlist vide.

## K. Gate officiel et limite d'environnement

Le premier audit officiel CI a ete execute contre un serveur Vite local qui avait charge
`Frontend/web-admin/.env` avec `VITE_ENABLE_PREVIEW=false`. Or le collecteur officiel ouvre
`#preview-admin`. Le mode preview etant volontairement desactive dans cette configuration
locale, l'application a lance les chargements API normaux. Le garde strict a alors remonte
42 routes non mockees, puis leurs erreurs de reponse et de console : 89 workflows executes,
213 constats, allowlist vide.

Cet echec n'est pas masque et n'est pas attribue a la correction visuelle I8. Il prouve que
le serveur d'audit doit etre lance comme en CI, avec le preview explicitement active. La
commande locale reproductible est :

```bash
VITE_ENABLE_PREVIEW=true \
VITE_API_BASE_URL=http://127.0.0.1:3000/api/v1 \
pnpm --filter @gestschool/web-admin exec vite --mode test --host 127.0.0.1 --port 5182
```

Puis, dans un second terminal :

```bash
VISUAL_AUDIT_URL=http://127.0.0.1:5182 \
VISUAL_AUDIT_SCOPE=ci \
VISUAL_AUDIT_OUTPUT=/tmp/gestschool-i8-official-ci-final \
pnpm visual:audit:mocked
```

Le lancement de ce nouveau serveur a ete bloque par les permissions d'execution de la session
Codex. Conformement a la regle du lot, l'audit responsive complet et l'audit accessibilite R8
ne sont pas declares valides apres cet echec initial.

## L. Verdict

- Correctifs visuels et accessibilite Admission I8 : GO local (81/81).
- LOT I8 complet : NO-GO tant que les audits officiels CI 89/89, responsive 166/166 et
  accessibilite R8 135/135 ne sont pas rejoues sur le serveur en mode test/preview.
- Allowlist : vide.
- Backend/API/metier : inchanges.
- Commit/push/deploiement : aucun.

Message de commit propose apres validation des trois gates officiels :

`refactor(web-admin): polish admission wizard accessibility and visual states`
