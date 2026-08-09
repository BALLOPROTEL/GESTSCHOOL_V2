# LOT R3 - Formulaires, modales et drawers metier responsive

Date de validation locale : 2026-08-09

Perimetre : frontend GestSchool uniquement. Aucun backend, contrat API, schema Prisma, table metier, filtre complexe, pagination ou navigation R2 n'a ete modifie.

## A. Formulaires audites

L'inventaire statique porte sur 37 formulaires metier, 316 champs et 55 boutons internes. Les 14 balises `form` restantes appartiennent a l'authentification, la recherche ou aux filtres et restent volontairement hors de la migration R3.

| Domaine | Formulaires | Champs | Boutons | Particularites auditees |
| --- | ---: | ---: | ---: | --- |
| IAM / utilisateurs | 1 | 15 | 2 | Identite, role, rattachements conditionnels, reinitialisation |
| Eleves | 1 | 16 | 3 | Identite, naissance, coordonnees, cursus, creation |
| Parents | 2 | 24 | 4 | Responsable, liaison eleve, dependances conditionnelles |
| Enseignants | 4 | 49 | 8 | Fiche, affectation, competences, disponibilites |
| Inscriptions | 1 | 6 | 2 | Eleve, annee, classe, cursus, placement |
| Referentiel academique | 6 | 75 | 6 | Annees, periodes, cycles, niveaux, classes, matieres |
| Salles | 4 | 39 | 5 | Salle, disponibilite, affectation et reservation |
| Vie scolaire | 6 | 28 | 6 | Absences, pointage groupe, emploi du temps, notifications |
| Notes et bulletins | 2 | 22 | 6 | Saisie en grille et generation de bulletins |
| Finance | 3 | 15 | 4 | Plans de frais, factures et paiements |
| Portail enseignant | 3 | 15 | 3 | Notes, presences et notifications |
| Profil et parametres | 4 | 12 | 6 | Profil, mot de passe, preferences et parametres du compte |
| Mosquee | 0 | 0 | 0 | Fonctionnalite desactivee par feature flag, aucun formulaire actif |

Les formulaires inline desktop avaient des largeurs propres a chaque panneau, souvent deux ou trois colonnes. Sur petit ecran, ces largeurs provoquaient compression, actions hors ecran et empilements heterogenes. Les erreurs etaient deja produites par les validateurs metier existants ; leurs regles n'ont pas change.

## B. Composants transformes

- Les 37 formulaires metier utilisent maintenant `ResponsiveForm`.
- Les confirmations destructives des modules eleves, inscriptions, finance, notes, IAM et enseignants utilisent `ConfirmDialog` via `useConfirmDialog`.
- Les formulaires d'edition deja ouverts utilisent `openOnMount` sans changer leur etat metier parent.
- Le libelle d'ouverture est explicite lorsque le titre seul ne suffit pas, notamment pour les preferences.
- Les erreurs des helpers metier touches sont annoncees avec `role="alert"`.

## C. Architecture dialog/drawer retenue

- `>=1024 px` : formulaire inline historique, sans role modal, sans trigger ajoute au rendu visible.
- `768-1023 px` : drawer lateral fixe, largeur maximale `42rem`, hauteur `100dvh` et un seul scroll interne.
- `<768 px` : drawer plein ecran, une colonne, header et actions sticky, safe areas respectees.
- `ConfirmDialogProvider` centralise les confirmations accessibles et les dialogues imbriques.
- `useDialogFocus` gere pile de dialogues, focus initial, trap, Escape, restauration et verrouillage du scroll.
- Le dirty state est local a chaque `ResponsiveForm`; fermer un formulaire modifie ouvre une confirmation explicite.

## D. Fichiers modifies

Les changements sont limites aux groupes suivants :

- orchestration : `src/app/App.tsx`, `src/main.tsx` ;
- primitives : `shared/components/responsive-form.tsx`, `confirm-dialog.tsx`, `dialog-focus.ts` ;
- modules : inscriptions, finance, notes, IAM, parents, portail enseignant, profil, referentiel, salles, vie scolaire, eleves et enseignants ;
- i18n : `shared/i18n.ts`, `shared/i18n.test.tsx` ;
- styles : `responsive-forms.css`, plus le retrecissement cible de deux regles historiques dans `forms.css` et `mobile-product.css` ;
- tests : tests des primitives et garde statique du contrat responsive ;
- verification : smoke frontend et audit visuel officiel.

La liste Git exacte doit etre relue avec `git status --short` avant tout commit.

## E. Primitives creees ou refactorees

- `ResponsiveForm` : rendu inline ou portal responsive, trigger, dirty state et semantics de dialogue.
- `ConfirmDialogProvider` / `useConfirmDialog` : confirmation partagee, ton destructif et labels localises.
- `useDialogFocus` : cycle de vie du focus et des overlays, compatible React Strict Mode.
- `responsive-forms.css` : contrats mobile/tablette, safe areas, actions sticky et reduced motion.

Aucune nouvelle dependance n'a ete ajoutee.

## F. Comportement mobile

- Formulaire plein ecran a 320, 360, 375, 390, 412 et 414 px.
- Champs a largeur disponible, police minimale de 16 px et cibles tactiles minimales de 44 px.
- Header sticky avec fermeture explicite ; actions sticky en bas avec safe area.
- Scroll horizontal nul dans les formulaires verifies.
- Le contenu liste reste prioritaire : le formulaire est rendu uniquement apres activation de son trigger.
- Aucun double scroll document/drawer : le document est verrouille pendant l'ouverture.

## G. Comportement tablette

- Drawer lateral jusqu'a `42rem` a 768, 820 et 1023 px.
- Formulaires conserves en une ou deux colonnes selon leur structure existante.
- Actions accessibles sans comprimer le contenu ; fond applicatif conserve et masque par backdrop.
- A 1024 px, retour au comportement inline conforme au breakpoint canonique.

## H. Comportement desktop

Le dashboard a ete compare pixel par pixel aux references R2 :

- 1280x720 : `abf759f89efbb710997c1c82b6b76ba34f8343132cb8fb109e33fa4ddb6d5635`, identique avant/apres ;
- 1440x900 : `28867cb700365392cbf15c70baa6fc335230b59d694de3db252342ea702fc376`, identique avant/apres.

Les formulaires restent inline a partir de 1024 px. Aucun drawer ou titre responsive n'est ajoute au DOM visible desktop.

## I. Clavier et focus

- Focus initial place sur la fermeture du drawer.
- Tab et Shift+Tab restent confines dans le dialogue actif.
- Escape ferme uniquement le dialogue au sommet de la pile.
- Le focus revient au trigger a la fermeture.
- Navigation et demontage nettoient listeners, pile d'overlays et verrou de scroll.
- Les champs invalides continuent d'etre focalises par les helpers metier existants.

Limite : Playwright ne reproduit pas fidelement le clavier logiciel iOS/Android ni son redimensionnement natif. Le viewport dynamique, le scroll du champ actif et le footer sticky sont verifies, mais une recette sur appareil physique reste requise.

## J. RTL et i18n

- Les textes nouveaux sont centralises dans l'i18n existante en FR/EN/AR.
- `dir` est transmis par le contexte i18n au formulaire et au dialogue.
- Les espacements utilisent les proprietes logiques et les safe areas.
- Les tests couvrent l'ouverture arabe, le RTL, le changement de langue et les confirmations.
- Aucune donnee metier libre n'est traduite.

## K. Gestion des erreurs

- Les erreurs restent proches de leur champ et conservent les messages et regles metier existants.
- Les helpers touches rendent les erreurs avec `role="alert"`.
- Une reserve verticale limite les sauts de mise en page.
- Le premier champ invalide reste focalise et centre par les helpers existants.

## L. Gestion du dirty state

- Les evenements `input` et `change` capturent localement l'etat modifie.
- Une fermeture par bouton ou Escape demande confirmation avant abandon.
- Le dialogue imbrique ne casse ni le focus trap ni le verrouillage du scroll.
- Une soumission reussie remet l'etat dirty a zero avant de deleguer au handler metier.

## M. Evolution des `!important`

| Mesure | Avant R3 | Apres R3 | Delta |
| --- | ---: | ---: | ---: |
| `!important` CSS | 1 144 | 1 144 | 0 |

Le nouveau fichier `responsive-forms.css` ne contient aucun `!important` et utilise uniquement les breakpoints 767 et 1023 px.

## N. CSS mort supprime ou neutralise

Aucune regle n'a ete supprimee sans preuve d'inutilisation, afin de preserver le desktop. Deux collisions historiques ont ete neutralisees de facon ciblee :

- le bouton de fermeture n'est plus capture par la regle mobile donnant `width: 100%` a tous les boutons `.module-form` ;
- le padding mobile historique des `.module-form` ne remplace plus le padding safe-area d'une surface responsive.

La consolidation plus large du CSS reste hors du perimetre R3.

## O. Resultats des tests

- Tests R3 cibles : 3 fichiers, 17 tests, tous reussis.
- Tests frontend complets : 30 fichiers, 156 tests, tous reussis.
- Typecheck frontend : reussi.
- Lint frontend : reussi.
- Build frontend avec origines API/storage explicites : reussi.
- Smoke frontend : reussi, `581364` octets CSS et `1144` `!important`.
- Audit visuel mocke CI : 73 workflows, zero constat.
- Audit visuel mocke complet : 150 workflows, zero constat.
- Allowlist visuelle : vide.
- Erreurs API imprevues, console, `pageerror` et overflow : zero dans les rapports finaux.
- `git diff --check` : reussi sur l'etat final.

## P. Limitations honnetes

- Le clavier logiciel reel et les comportements IME doivent etre verifies sur iOS et Android physiques.
- Le mode audit integre avec backend reel n'est pas requis par R3 et n'a pas ete relance.
- Certaines actions internes d'annulation appartiennent encore a leur etat metier parent ; la protection dirty couvre la fermeture du drawer et Escape.
- Les 14 formulaires d'authentification, recherche et filtres ne sont pas des formulaires metier migres par R3.

## Q. Dette restante pour R4-R10

- R4 : tables, listes, filtres, pagination et densite mobile/tablette.
- Lots responsive suivants : recette clavier sur appareils, derniers workflows complexes et verification integree de bout en bout.
- Dette CSS historique : 1 144 `!important`, inchangee par R3.
- Les modules desactives par feature flag, dont Mosquee, restent hors activation fonctionnelle.

## R. Verdict R3

**GO pour commit**, sous reserve que les validations finales restent vertes et que le diff demeure strictement frontend/documentation. Aucun commit ni push n'est realise dans cette passe.

## S. Recommandation precise pour R4

Centraliser le contrat de table responsive sans revenir aux observers DOM : colonnes declaratives, action sticky uniquement quand justifiee, scroll horizontal borne, densite adaptee aux grands volumes, headers/cellules accessibles, puis tester les listes a 100 et 200 lignes aux memes breakpoints R1.

## T. Message de commit propose

`refactor(web-admin): make business forms responsive and accessible`
