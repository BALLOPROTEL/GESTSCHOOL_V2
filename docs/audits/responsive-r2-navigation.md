# LOT R2 - Navigation mobile et tablette definitive

Date de validation : 2026-08-09

## Verdict

GO pour le LOT R2. Le mobile et la tablette partagent maintenant un drawer unique, accessible et pilote par React. Le rail tablette ouvre cette navigation complete sans comprimer le contenu. Le desktop valide par R1 reste strictement identique. Aucun ecran metier, contrat API ou composant backend n'a ete modifie.

## A. Architecture retenue

- Un controleur React unique, `useNavigationDrawer`, porte l'etat, le declencheur d'origine, le focus trap, Escape, la restauration du focus et le verrouillage du scroll.
- Le header mobile et le rail tablette commandent le meme drawer.
- Le drawer reutilise le modele de navigation, les permissions, les feature flags et les actions utilisateur existants.
- Le rail conserve les icones de modules et expose les labels par `aria-label` et tooltip local rendu en portail.
- Le profil desktop/tablette reste dans la sidebar. Le drawer expose profil, preferences, notifications et deconnexion sur mobile et tablette.
- Les z-index, cibles tactiles, largeurs et safe areas viennent des tokens R1.

## B. Drawer, rail et bottom navigation

Le drawer a ete retenu pour les destinations principales et secondaires. Aucune bottom navigation n'a ete ajoutee : GestSchool expose de nombreuses destinations variables selon le role et les permissions. Limiter arbitrairement la barre a quatre ou cinq modules aurait duplique certaines routes et rendu les autres moins previsibles.

Le rail tablette reste visible, compact a 76 px et sert de navigation rapide. Son nouveau bouton de navigation complete est place juste sous la marque. Les tooltips sont disponibles au survol et au focus, sans agrandir le rail.

## C. Fichiers modifies

Implementation :

- `Frontend/web-admin/src/app/App.tsx`
- `Frontend/web-admin/src/app/navigation/header-mobile-panel.tsx`
- `Frontend/web-admin/src/app/navigation/header-navigation.tsx`
- `Frontend/web-admin/src/shared/components/app-sidebar.tsx`
- `Frontend/web-admin/src/shared/i18n.ts`
- `Frontend/web-admin/src/main.tsx`
- `Frontend/web-admin/src/styles/layout.css`
- `Frontend/web-admin/src/styles/mobile-product.css`
- `Frontend/web-admin/src/styles/premium-v3-foundation.css`
- `Frontend/web-admin/src/styles/navigation-responsive.css` (nouveau)

Tests et preuve :

- `Frontend/web-admin/src/app/navigation/use-navigation-drawer.test.tsx` (nouveau)
- `Frontend/web-admin/src/app/navigation/use-navigation-drawer.ts` (nouveau)
- `Frontend/web-admin/src/app/navigation/header-navigation.test.tsx`
- `Frontend/web-admin/src/shared/components/app-sidebar.test.tsx`
- `Frontend/web-admin/src/shared/i18n.test.tsx`
- `scripts/visual-audit-core-workflows.mjs`
- `docs/audits/responsive-r2-navigation.md` (ce rapport)

## D. Composants crees ou refactorises

### `useNavigationDrawer`

- ouverture depuis n'importe quel declencheur ;
- fermeture explicite et apres navigation ;
- focus initial sur le bouton de fermeture ;
- boucle Tab et Shift+Tab dans le drawer ;
- fermeture par Escape ;
- retour du focus vers le declencheur exact ;
- ajout et retrait fiable de `mobile-shell-open` ;
- nettoyage compatible React Strict Mode.

### `HeaderNavigation` et `HeaderMobilePanel`

- controleur partage optionnel avec fallback local pour l'isolation du composant ;
- dialogue modal nomme et traduit ;
- etat `aria-expanded` synchronise ;
- `aria-current="page"` sur la destination active ;
- fermeture apres recherche, navigation, preference ou action utilisateur ;
- role utilisateur traduit declarativement.

### `AppSidebar`

- declencheur de drawer dedie au rail tablette ;
- etat actif perceptible par `aria-current`, pas uniquement par la couleur ;
- tooltips accessibles, LTR et RTL ;
- restauration du focus apres fermeture du menu profil par Escape.

## E. Comportement par breakpoint

| Zone | Comportement final |
| --- | --- |
| `<480` | Header compact, sidebar masquee, drawer pleine hauteur scrollable, safe areas et cibles de 44 px |
| `480-767` | Meme navigation mobile avec largeur bornee et backdrop tactile |
| `768-1023` | Rail 76 px, tooltips, et bouton ouvrant le drawer complet sans comprimer le contenu |
| `1024-1279` | Sidebar compacte R1 de 224 px, navigation existante conservee |
| `>=1280` | Sidebar et header desktop R1 strictement inchanges |

Les frontieres `767/768`, `1023/1024` et `1279/1280` sont testees explicitement.

## F. Resultats mobile et tablette

L'audit officiel couvre :

- 320x568 ;
- 360x800 ;
- 375x812 ;
- 390x844 ;
- 412x915 ;
- 767 px ;
- 768x1024 ;
- 820x1180 ;
- 1023 px ;
- 1024x768 et 1024x1366 ;
- 1180x820 ;
- 1279 px ;
- zoom navigateur 200 %.

Resultat final : aucun overflow document, aucune cible du drawer inferieure a 44 px, aucun chevauchement et aucun blocage de chargement.

La premiere passe CI a volontairement echoue et a revele deux regressions R2 : bouton de fermeture a 41,6 px et boutons du drawer tablette inherant le style CTA global. Les dimensions et exclusions de style sont maintenant locales a la navigation. Le mauvais parametrage local de l'URL API du premier lancement a egalement ete corrige avant la preuve finale.

## G. RTL

- Drawer arabe ouvert depuis la droite.
- Rail place du cote logique attendu.
- Ordre marque/fermeture et contenu des liens inverse proprement.
- Tooltip positionne du bon cote de l'icone.
- Textes et alignements suivent `dir="rtl"`.
- Aucun fallback anglais ou francais nouveau dans l'interface arabe.

## H. Clavier et accessibilite

- Escape ferme drawer et menu profil.
- Tab et Shift+Tab restent dans le drawer ouvert.
- Le focus revient au bouton mobile ou au bouton du rail qui a ouvert le drawer.
- Focus visible sur fermeture, navigation du rail, destinations et profil.
- Drawer expose `role="dialog"`, `aria-modal`, `aria-controls` et un nom localise.
- Destinations actives exposees avec `aria-current="page"`.
- Cibles tactiles du drawer et du rail : 44 px minimum.
- `prefers-reduced-motion` ramene les transitions a une duree quasi nulle.

## I. Non-regression desktop

Les captures R1 et R2 sont identiques bit a bit :

- 1280x720 : `abf759f89efbb710997c1c82b6b76ba34f8343132cb8fb109e33fa4ddb6d5635`
- 1440x900 : `28867cb700365392cbf15c70baa6fc335230b59d694de3db252342ea702fc376`

La densite, le branding Premium V3, la sidebar et le header desktop n'ont donc aucune difference visuelle mesurable.

## J. Evolution des `!important`

| Mesure | R1 | R2 | Evolution |
| --- | ---: | ---: | ---: |
| `!important` | 1 191 | 1 144 | -47 |
| CSS source | 573 290 octets | 574 992 octets | +1 702 octets |
| Lignes CSS | 24 869 | 24 963 | +94 |
| CSS principal compile | 446,15 kB | 447,47 kB | +1,32 kB |
| CSS principal gzip | 68,79 kB | 69,02 kB | +0,23 kB |

Aucun `!important` n'a ete ajoute dans la nouvelle couche R2. La diminution vient de la suppression de correctifs mobiles dupliques.

## K. Regles CSS supprimees

- Ancienne definition mobile du backdrop dupliquee dans `layout.css`.
- Ancienne definition mobile du mouvement et de la visibilite du drawer dupliquee dans `layout.css`.
- Dimensions de fermeture inferieures au token tactile dans `mobile-product.css`.
- Mise en page, hover, et dimensions d'icones des liens mobiles dupliquees dans `mobile-product.css`.
- Masquage tablette historique du drawer et du backdrop dans `premium-v3-foundation.css`.

Les regles communes sont maintenant regroupees dans `navigation-responsive.css`; les surcharges strictement mobiles restent dans `mobile-product.css`.

## L. Tests et resultats

- Tests navigation/i18n cibles : 4 fichiers, 25/25 PASS.
- Tests frontend complets : 27 fichiers, 138/138 PASS.
- Typecheck frontend : PASS.
- Lint frontend : PASS.
- Build avec origines API et storage explicites : PASS.
- Smoke frontend : PASS (`574 992` octets CSS, `1 144` `!important`).
- Audit visuel mocke CI : 73/73, zero constat.
- Audit visuel mocke complet : 150/150, zero constat.
- Allowlist visuelle : vide.
- Erreurs API imprevues, console, `pageerror`, loading bloque et overflow : zero.
- `git diff --check` : PASS.

## M. Dette restante

- Les tables, filtres et actions metier restent hors perimetre et devront etre adaptes dans R3-R6.
- Le CSS global conserve 1 144 `!important`; R2 en retire 47 mais ne pretend pas solder cette dette historique.
- Le rail repose encore sur le registre de navigation global existant, volontairement conserve pour garder une source unique de permissions et de feature flags.
- L'audit avec backend reel reste reserve a la validation integree de release ; R2 est valide avec le mode mocke strict officiel.

## N. Limites honnetes

- Aucun test manuel avec lecteur d'ecran materiel n'a ete realise ; la semantique et la navigation clavier sont couvertes automatiquement.
- Les tooltips sont testes au focus et en RTL, mais la matrice visuelle officielle ne capture pas chaque tooltip de chaque module.
- Les contenus de listes tres volumineux et les formulaires longs ne relevent pas de R2.

## O. Verdict R2

GO pour commit, sous reserve de la procedure habituelle de validation utilisateur. Aucun commit, push ou deploiement n'est effectue dans ce lot.

## P. Recommandations pour R3

1. Traiter le dashboard et ses cartes aux largeurs mobiles/tablettes sans modifier le shell R2.
2. Conserver le drawer et le rail comme primitives figees ; ne pas dupliquer leur logique dans les ecrans.
3. Ajouter les tests de contenu long aux cartes dashboard en FR/EN/AR.
4. Reutiliser les viewports et assertions strictes R2 pour chaque composant migre.
5. Reporter les tables, formulaires et modales aux lots prevus plutot que les melanger au dashboard.

## Q. Message de commit propose

`refactor(web-admin): finalize mobile and tablet navigation`

Ce rapport ne cree ni commit, ni push, ni deploiement.
