# LOT R6 - Workflows metier responsive

## A. Workflows audites

Le lot couvre IAM, eleves, parents, enseignants, inscriptions, finance, notes et bulletins,
absences, emploi du temps et Pilotage. Les ecrans associes indispensables aux parcours ont ete
conserves; aucun contrat API, RBAC ou calcul metier n'a ete modifie.

## B. Diagnostic avant par workflow

| Workflow | Objectif principal | Probleme mobile avant R6 | Cause | Solution R6 |
| --- | --- | --- | --- | --- |
| IAM | Trouver puis administrer un compte | Le formulaire precedait la liste et surchargeait l'entree | Creation et consultation partageaient la meme etape | Entree list-first, creation/edition dans une etape dediee |
| Eleves | Consulter puis modifier un dossier | Le contexte du dossier se perdait entre liste, detail et formulaire | Aucun resume persistant de l'eleve selectionne | Barre de contexte identite, matricule, statut et classe |
| Parents | Consulter un responsable et ses liens | Identite et lien enfant etaient repetes sans contexte clair | Les sous-parcours n'exposaient pas leur cible | Contextes distincts fiche responsable et liaison enfant |
| Enseignants | Gerer fiche, affectations, competences et charge | Cinq onglets occupaient trop de largeur et le professeur cible etait peu visible | Sous-navigation desktop conservee telle quelle | Selecteur compact mobile et contexte enseignant |
| Inscriptions | Creer et valider un placement | Le contexte eleve/annee/classe se perdait dans le formulaire | Liste et saisie etaient separees sans resume | Contexte du placement et retour explicite a la liste |
| Finance | Consulter une facture puis enregistrer une action | L'action paiement ouvrait un ecran sans rappeler la facture cible | Le contexte restait enfoui dans les champs | Resume facture, eleve, statut et reste a payer |
| Notes | Saisir dans la bonne classe/periode | Le contexte actif disparaissait apres le filtre | Le filtre et la saisie ne partageaient pas de resume | Contexte annee, classe, periode et cursus |
| Vie scolaire | Examiner puis valider une absence | La validation n'exposait pas immediatement eleve, date et statut | Le contexte etait place loin dans le formulaire | Resume absence et retour explicite au journal |
| Emploi du temps | Lire les creneaux puis modifier | La grille semaine desktop et la liste etaient affichees ensemble sur mobile | Representation unique pour tous les viewports | Mode liste/semaine explicite sur mobile; deux vues conservees sur tablette |
| Pilotage | Lire une synthese puis ouvrir un module d'action | Quatre domaines et les alertes etaient ouverts, page de 3 537 px | Toute l'information etait developpee par defaut | Divulgation progressive, deux domaines ouverts et actions rapides horizontales |

## C. Modifications UX apportees

- Priorite list-first pour IAM et conservation des CTA existants.
- Sous-navigation compacte seulement lorsque le parcours depasse quatre etapes.
- Resume de contexte partage pour les formulaires ou actions qui changent d'ecran.
- Divulgation progressive partagee pour les domaines Pilotage.
- Choix liste/semaine explicite pour l'emploi du temps mobile.
- Menus de lignes stables pendant le scroll horizontal local du tableau.
- Libelles Inscriptions rendus declaratifs en FR, EN et AR.

## D. Fichiers modifies

Frontend concerne: ecrans IAM, eleves, parents, enseignants, inscriptions, finance, notes,
vie scolaire, Pilotage; primitives `workflow-guide`, `responsive-workflow`, menu de ligne,
i18n, styles R6 et tests associes. Le runner officiel Playwright est complete par les parcours R6.
La liste Git exacte est fournie par `git status --short` a la cloture du lot.

## E. Primitives R1-R5 reutilisees

- Shell et breakpoints R1.
- Navigation mobile/tablette R2.
- `ResponsiveForm` R3.
- `ResponsiveDataTable`, filtres et `RowActionMenu` R4.
- KPI et cartes de synthese R5.
- `WorkflowGuide` existant, etendu sans nouvelle bibliotheque.

## F. Composants refactores

- `WorkflowNavigation`: tabs existants plus selecteur compact partage au-dela de quatre etapes.
- `WorkflowContextBar`: resume cible/action reutilisable.
- `ResponsiveWorkflowDisclosure`: contenu progressif mobile et contenu complet tablette/desktop.
- `RowActionMenu`: fermeture sur scroll viewport, pas sur scroll local de table.

## G. IAM avant / apres

Avant, le formulaire de compte precedait les donnees. Apres, la liste est l'entree obligatoire;
`Creer l'utilisateur` ouvre une etape dediee, `Modifier` conserve la cible et le retour revient a
la liste. Les actions secondaires restent dans le menu de ligne et le RBAC est inchange.

## H. Eleves avant / apres

Avant, la cible devenait implicite apres `Voir` ou `Modifier`. Apres, identite, matricule, statut
et classe restent visibles dans un resume compact avec retour a la base eleves. Les parents,
inscriptions et donnees libres ne sont ni dupliques ni traduits automatiquement.

## I. Parents avant / apres

La fiche responsable et la liaison parent-enfant disposent maintenant de contextes distincts.
Le role, le statut, l'enfant cible et le nombre de liens sont presentes sans recopier la fiche.

## J. Enseignants avant / apres

Les cinq destinations deviennent un selecteur mobile compact, tout en restant des tabs sur
tablette et desktop. La fiche active expose matricule et statut; affectations, competences,
charge et documents ne sont plus presentes comme cinq panneaux simultanes sur petit ecran.

## K. Inscriptions avant / apres

Le parcours conserve eleve, annee, classe et statut pendant creation ou edition. Le retour liste
est explicite. Les titres, colonnes, statuts, placements, fallback matricule et detail sont
traduits declarativement. La logique de validation et de placement est strictement conservee.

## L. Finance avant / apres

L'action facture ouvre Paiements avec facture, eleve, statut et reste a payer visibles. Le menu
d'action reste accessible pendant le scroll horizontal local. Aucun fournisseur ou paiement reel
n'est active.

## M. Notes / bulletins avant / apres

Le contexte annee, classe, periode et cursus reste visible dans la saisie. `Modifier le contexte`
ramene aux filtres sans modifier les calculs, generations PDF ou regles pedagogiques.

## N. Vie scolaire avant / apres

Le journal mene a la validation avec eleve, date, statut et nombre de pieces jointes visibles.
Le retour au journal est explicite; upload, validation et historique conservent leurs contrats.

## O. Emploi du temps avant / apres

Mobile affiche une seule representation a la fois, liste par defaut puis semaine sur demande.
Tablette et desktop conservent la liste et la vraie grille hebdomadaire. Aucun creneau ni action
n'est supprime.

## P. Pilotage avant / apres

Les KPI restent visibles. Scolarite et alertes sont ouvertes par defaut; vie scolaire et finance
sont repliees mais exposees par un bouton accessible. Les actions rapides passent dans une bande
horizontale locale. Toute information reste dans le DOM du domaine et redevient visible a la
demande.

## Q. Hauteur Pilotage a 390 x 844

| Mesure | R5 | R6 | Evolution |
| --- | ---: | ---: | ---: |
| Hauteur document | 3 537 px | 2 660 px | -877 px (-24,8 %) |
| Sections ouvertes par defaut | 4 | 2 | -2 |
| Viewports verticaux approximatifs | 4,19 | 3,15 | -1,04 |

La cible indicative de 25 % est approchee sans cacher artificiellement un domaine ni perdre une
information. Le gain mesure est substantiel et la priorite metier est conservee.

## R. Mobile

- 320, 360, 375, 390 et 412 px sont couverts par les matrices officielles.
- Une action principale reste identifiable; les actions de ligne demeurent dans `...`.
- Les tables gardent un scroll local et aucune page ne cree de scroll horizontal global.
- Les workflows longs exposent le contexte sans multiplier les elements sticky.

## S. Tablette

- 768x1024, 820x1180, 1024x768, 1024x1366 et 1180x820 sont couverts.
- Les tabs et grilles utiles restent disponibles; les formulaires utilisent les drawers R3.
- L'emploi du temps conserve sa densite calendrier et Pilotage ses cartes en grille.

## T. Desktop

Les vues 1280x720 et 1440x900 conservent la navigation, les tabs, la densite et les contenus R5.
Les disclosures Pilotage sont toujours developpees a partir de 768 px; aucun parcours desktop
n'est transforme en parcours mobile.

## U. FR / EN / AR et RTL

Les nouveaux labels passent par l'i18n existante. Les valeurs metier libres restent intactes.
Le selecteur d'etape, les contextes, les actions, les colonnes et les disclosures utilisent les
proprietes logiques et conservent `dir=rtl` en arabe.

## V. Accessibilite

- Cibles tactiles de 44 px sur selecteurs, disclosures et modes d'emploi du temps.
- Roles `tab`, `menu`, `menuitem`, `dialog` et associations de table preserves.
- Focus du menu et du drawer de formulaire restaure apres fermeture.
- Clavier, zoom 200 %, reduced motion et contrastes restent dans le gate officiel.

## W. Metriques avant / apres

| Indicateur | Avant R6 | Apres R6 |
| --- | ---: | ---: |
| Pilotage mobile | 3 537 px | 2 660 px |
| Domaines Pilotage ouverts | 4 | 2 |
| Ecrans avec navigation compacte >4 etapes | 0 | 1 partagee, Enseignants |
| Contextes persistants partages | 0 | 7 parcours |
| Modes emploi du temps mobile | 2 simultanes | 1 actif sur 2 |
| Composants exclusivement mobiles ajoutes | 0 | 0 |
| Primitives adaptatives partagees ajoutees | 0 | 2 |

## X. Evolution de `!important`

- Avant R6: 1 080 occurrences.
- Apres R6: 1 080 occurrences.
- Evolution: 0. Le nouveau fichier R6 n'en ajoute aucune.

## Y. Evolution CSS

| Mesure | R5 | R6 | Evolution |
| --- | ---: | ---: | ---: |
| CSS source | 580 608 o | 584 637 o | +4 029 o |
| Lignes CSS | 25 222 | 25 440 | +218 |
| CSS build global | 452,84 kB | 455,49 kB | +2,65 kB |
| CSS build gzip | 70,37 kB | 70,81 kB | +0,44 kB |
| JS principal | 438,60 kB | 442,64 kB | +4,04 kB |
| JS principal gzip | 127,49 kB | 129,36 kB | +1,87 kB |

La hausse correspond aux deux primitives partagees, aux contextes et aux traductions. Aucune
dependance n'est ajoutee et aucun gros framework mobile n'est introduit.
Le smoke fixe le nouveau plafond a 585 000 octets, soit 363 octets de marge. Cette borne remplace
le budget R3 devenu inferieur au resultat documente de R6; elle reste bloquante et mesuree.

## Z. Tests et audits

Resultats apres correction du debordement structurel Absences:

- Tests R6 cibles: PASS.
- Tests frontend complets: PASS, 35 fichiers et 194 tests.
- Typecheck, lint et build: PASS.
- Smoke frontend: PASS, 584 637 octets et 1 080 `!important`.
- Tests CSP: PASS, 1/1.
- Tests du collecteur visuel: PASS, 6/6; lint du runner: PASS.
- Audit visuel mocked CI avant le dernier correctif: 89/89, zero constat.
- Audit visuel mocked complet avant le dernier correctif: 166/166, zero constat.
- Rejeu apres le dernier correctif: bloque par l'indisponibilite de l'autorisation Chromium hors
  sandbox; le sandbox refuse le lancement de Chromium. Les resultats precedents ne sont donc pas
  presentes comme preuve finale du dernier etat.
- Allowlist: vide.
- `git diff --check`: a relancer a la cloture apres mise a jour du present rapport.

## AA. Limites honnetes

- Les parcours Playwright utilisent les fixtures API officielles, pas un backend reel.
- Le dernier rejeu des deux matrices Playwright doit encore etre execute apres la correction du
  debordement cache de l'ecran Absences (696 px avant, 366 px apres a 390 px de viewport).
- Les donnees de fixture ne couvrent pas tous les textes libres et volumes de production.
- Pilotage atteint -24,8 %, legerement sous la cible indicative, volontairement sans masquer un
  domaine ou rendre ses actions inaccessibles.
- La persistance et les contrats backend sont hors perimetre de ce lot frontend.

## AB. Dette restante R7-R10

- R7: finaliser les ecrans provisoires seulement lorsque leurs besoins metier sont valides.
- R8/R9: profiler les rerenders des grands ecrans et poursuivre la reduction CSS mesuree.
- R10: rejouer les parcours integres avec API, PostgreSQL, Redis et stockage reels de recette.
- Les contenus libres exceptionnellement longs devront etre revalides sur un jeu representatif.

## AC. Verdict R6

NO-GO commit tant que les audits mocked CI (89 workflows) et complet (166 workflows) n'ont pas
ete rejoues avec le detecteur de debordement structurel final. Le code et les validations hors
navigateur sont verts; aucun commit ou push n'est realise dans ce lot.

## AD. Recommandations exactes pour R7

1. Partir des feature flags existants et ne rendre visible aucun placeholder.
2. Definir les donnees, permissions et etats reels du portail eleve et du module Mosquee avant UI.
3. Reutiliser `WorkflowContextBar`, `ResponsiveWorkflowDisclosure`, `ResponsiveForm` et
   `ResponsiveDataTable` plutot que creer des variantes par module.
4. Ajouter des parcours Playwright mobile/tablette a chaque fonctionnalite rendue active.
5. Conserver le gate visuel strict avec allowlist vide.

## AE. Message de commit propose

`refactor(web-admin): streamline responsive business workflows`
