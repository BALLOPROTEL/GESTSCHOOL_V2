# LOT R4 - Tables, listes, filtres et pagination responsive

Date de validation : 2026-08-11

## Verdict

GO pour le LOT R4.

- Aucun changement backend, Prisma, API ou metier.
- Desktop a partir de 1280 px preserve.
- Aucun overflow horizontal du document detecte par l'audit officiel.
- Scroll horizontal limite au composant de table.
- Audit mocke CI : 73 workflows reussis, 0 constat.
- Audit mocke complet : 150 workflows reussis, 0 constat.
- Allowlist visuelle : vide.

## A. Inventaire audite

Le frontend contenait 46 tables actives reparties dans 21 fichiers de features.

| Domaine | Tables migrees | Contenu principal |
| --- | ---: | --- |
| Eleves | 1 | base eleves |
| Parents | 2 | responsables, liaisons parent-eleve |
| Enseignants | 5 | enseignants, competences, affectations, charges, documents |
| Inscriptions | 1 | placements et statuts |
| Utilisateurs et droits | 2 | comptes, matrice de permissions |
| Finance | 3 | plans, factures, paiements |
| Notes et bulletins | 5 | evaluations, notes, periodes et bulletins |
| Salles | 5 | salles, affectations, disponibilites et usages |
| Vie scolaire | 4 | absences, justificatifs, emploi du temps et notifications |
| Referentiel academique | 6 | annees, periodes, cycles, niveaux, classes et matieres |
| Pilotage et rapports | 1 | indicateurs et rapports pagines |
| Portail parent | 8 | enfants, notes, absences, factures et emploi du temps |
| Portail enseignant | 3 | classes, emploi du temps et suivi |

Le module Mosquee est masque par feature flag et ne presente pas de table active a migrer. Aucune fausse fonctionnalite n'a ete ajoutee.

## B. Strategie par type de donnees

1. Les petites collections restent des tables compactes, sans conversion systematique en grandes cartes.
2. Les donnees tabulaires conservent leurs colonnes et utilisent un scroll horizontal local explicite.
3. La colonne d'action reste compacte et sticky lorsque le tableau le requiert.
4. Les filtres complexes deviennent un drawer jusqu'a 1023 px et restent en ligne a partir de 1024 px.
5. Le desktop conserve ses tables denses et ses largeurs historiques.

## C. Primitives partagees

### ResponsiveDataTable

- Region nommee et accessible.
- Detection locale de l'overflow par `ResizeObserver`.
- `tabIndex=0` uniquement lorsque la table est reellement scrollable.
- Indicateur de scroll traduit en FR, EN et AR.
- Etat debut/fin expose par attributs `data-*` sans muter le DOM global.
- Nettoyage de l'observer au demontage.

### ResponsiveFilterPanel

- Affichage inline a partir de 1024 px.
- Drawer portalise sous 1024 px.
- Resume du nombre de filtres actifs.
- Focus trap, fermeture par Escape et restauration du focus.
- Direction RTL appliquee localement.

### RowActionMenu

- Menu portalise dans `document.body` pour supprimer le clipping des cellules.
- Placement calcule dans le viewport et compatible RTL.
- Fermeture hors clic, au scroll, au resize et avec Escape.
- Navigation clavier Fleche haut/bas, Home et End.
- Retour du focus sur le bouton declencheur.
- Cible tactile de 44 px sur mobile, tablette et pointeur tactile.

### ResponsivePagination

- Precedent/suivant et etat `Page X sur Y`.
- Libelles compacts visuellement sur mobile et conserves pour les lecteurs d'ecran.
- Etat disabled natif aux bornes.

## D. Fichiers principaux

Nouvelles primitives :

- `Frontend/web-admin/src/shared/components/responsive-data-table.tsx`
- `Frontend/web-admin/src/shared/components/responsive-filter-panel.tsx`
- `Frontend/web-admin/src/shared/components/responsive-pagination.tsx`
- `Frontend/web-admin/src/shared/components/row-action-menu.tsx`

Tests de garde :

- `Frontend/web-admin/src/shared/components/responsive-data-controls.test.tsx`
- `Frontend/web-admin/src/shared/components/responsive-data-contract.test.ts`

Les composants des 13 domaines inventories ont ete branches sur ces primitives. Les styles partages sont portes par `tables.css` et `responsive-forms.css`.

## E. Mobile

- Viewports valides : 320, 360, 375, 390, 412 et 414 px.
- Aucune transformation massive en cartes verticales.
- Tables denses conservees dans un conteneur local scrollable.
- Indicateur de scroll visible uniquement lorsqu'il est utile.
- Colonne d'action reduite et accessible.
- Filtres retires du flux permanent et ouverts dans un drawer plein ecran sur mobile etroit.
- Aucun double scroll horizontal.

## F. Tablette

- 768 x 1024 et 820 x 1180 utilisent les drawers de filtres et gardent les tables locales.
- 1024 x 768 conserve une table dense avec filtres inline, conformement au seuil 1024-1279.
- Les appareils a pointeur tactile gardent des cibles d'au moins 44 px sans nouveau breakpoint.

## G. Desktop

- Les seuils 1280 x 720, 1440 x 900 et 1920 x 1080 sont valides.
- Colonnes, densite, filtres et actions existants sont conserves.
- Aucune conversion en presentation mobile a partir de 1280 px.

## H. Filtres et recherche

- 16 panneaux de filtres partagent le meme comportement.
- La recherche reste dans le formulaire existant et ne change pas de contrat.
- Les actions Appliquer et Reinitialiser restent dans le drawer et sont tactiles.
- Les champs conservent leurs labels et leurs valeurs pendant l'ouverture/fermeture.

## I. Pagination

Le rapport etait la seule pagination explicite active. Elle utilise maintenant la primitive partagee. Les listes non paginees n'ont pas recu de pagination artificielle : le contrat API et le metier restent inchanges.

## J. Menus d'actions

Onze points d'integration directs utilisent `RowActionMenu`; le menu du referentiel est reutilise par six sections. Les anciens menus absolus propres aux modules Eleves, Inscriptions et Enseignants ont ete supprimes.

## K. Colonnes sticky

- Proprietes logiques `inset-inline-start` et `inset-inline-end` utilisees.
- Premiere colonne non figee sur les petits ecrans.
- Colonne d'action sticky et compacte lorsque necessaire.
- Le menu n'est plus enfant de la cellule sticky et ne peut plus etre coupe par son overflow.

## L. RTL et i18n

- Nouvelles chaines fournies en anglais et arabe.
- Hint de scroll, filtres, pagination et labels d'action traduits.
- Placement du menu et colonnes sticky fondes sur les axes logiques.
- Audit arabe execute sur tablette paysage et mobile, direction RTL preservee.

## M. Accessibilite

- `th` et structure native des tables conserves.
- Region scrollable nommee.
- Menus avec `aria-haspopup`, `aria-expanded`, `role=menu` et `role=menuitem`.
- Drawers avec `role=dialog`, `aria-modal`, focus trap et fermeture Escape.
- Cibles tactiles controlees par l'audit a 43,5 px minimum effectif.

## N. Overflow

L'audit officiel controle `document.documentElement.scrollWidth <= clientWidth` avec une tolerance technique de 4 px. Aucun des 150 workflows n'a produit de constat d'overflow. Les tables peuvent depasser leur conteneur uniquement a l'interieur de `ResponsiveDataTable`.

## O. Performance

- Aucune nouvelle dependance.
- Une table reste une table : pas de duplication DOM en cartes par ligne.
- Un seul `ResizeObserver` local par table, nettoye au demontage.
- Menus et drawers ne sont montes que lorsqu'ils sont ouverts.
- Lazy loading existant preserve.

## P. Largeurs minimales

Les largeurs denses 44, 56, 66 et 72 rem restent reservees aux tables qui en ont besoin. Sur mobile, les variantes denses utilisent 40 ou 42 rem dans le conteneur local. Aucune `min-width` de table n'est appliquee au document ou au shell.

## Q. Dette CSS

| Metrique | Avant R4 | Apres R4 | Evolution |
| --- | ---: | ---: | ---: |
| CSS source | 581 364 octets | 579 096 octets | -2 268 octets |
| `!important` | 1 144 | 1 085 | -59 |
| CSS principal build | 452,90 kB | 451,04 kB | -1,86 kB |
| CSS principal gzip | 70,00 kB | 69,96 kB | -0,04 kB |

Le JS principal passe de 427,70 kB a 430,96 kB (+3,26 kB, +0,77 kB gzip) en contrepartie des quatre primitives accessibles partagees. Elles sont egalement separees en chunks lazy lorsqu'elles ne sont pas necessaires au shell initial.

## R. CSS mort supprime

- Positionnements absolus des anciens menus modules.
- Correctifs `z-index` bases sur `:has()` dans les cellules.
- Duplications clair/sombre des menus Eleves, Inscriptions et Enseignants.
- Correctifs mobiles de menu devenus inutiles apres portalisation.

## S. Validations

| Controle | Resultat |
| --- | --- |
| Tests R4 cibles | 20/20 |
| Tests frontend complets | 173/173 |
| Typecheck frontend | PASS |
| Lint frontend | PASS |
| Build frontend | PASS |
| Smoke frontend | PASS |
| Tests collecteur visuel | PASS |
| Lint collecteur visuel | PASS |
| Audit visuel mocke CI | 73/73, 0 constat |
| Audit visuel mocke complet | 150/150, 0 constat |
| `git diff --check` | PASS |

Preuves visuelles locales non suivies par Git :

- `/tmp/gestschool-r4-final-ci-visual/2026-08-11T10-47-23-244Z`
- `/tmp/gestschool-r4-full-visual/2026-08-11T10-29-05-292Z`

## T. Limites honnetes

- Les listes ne sont pas virtualisees. Aucun volume actuel ou contrat API ne justifie l'ajout d'une bibliotheque de virtualisation dans R4.
- La pagination n'est ajoutee qu'au flux qui en possedait deja une afin de ne pas modifier les contrats metier.
- L'audit integre avec backend reel n'appartient pas a cette passe responsive et n'a pas ete relance.
- Le module Mosquee reste masque par feature flag.

## U. Dette restante

- R5 : dashboard, KPI et graphiques.
- R6 : finitions specifiques des modules metier hors tables.
- Lots suivants : optimisation des tres grands volumes uniquement avec mesures et pagination backend explicite.

## V. Recommandations R5

1. Reutiliser les memes seuils R1 sans creer de nouvelle grille responsive.
2. Adapter les KPI par priorite metier plutot que les empiler uniformement.
3. Conserver la parite structurelle clair/sombre et FR/EN/AR.
4. Etendre l'audit officiel aux interactions de graphiques sans ajouter d'allowlist.

## W. Message de commit

`refactor(web-admin): make data workflows responsive`
