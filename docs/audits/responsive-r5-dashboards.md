# LOT R5 - Dashboard, KPI, syntheses et graphiques responsive

Date de validation : 2026-08-11

## A. Inventaire audite

| Vue | Blocs audites | Decision R5 |
| --- | --- | --- |
| Dashboard principal | 4 KPI, taches, alertes, 2 syntheses graphiques | Migration complete vers les primitives R5 |
| Finance | 4 KPI de recouvrement, 7 KPI de synthese, statuts et compteurs | Migration complete |
| Notes et bulletins | 6 KPI de contexte et de production | Migration complete |
| Pilotage | domaines de pilotage, KPI par domaine, raccourcis | Migration complete, page encore longue |
| Rapports et conformite | 6 KPI, 3 graphiques de tendance | Migration complete |
| Enseignants | synthese de charge, liste et fiche enseignant | KPI et syntheses migres |
| Salles | synthese de fiche salle | Carte migree |
| Parents | synthese de fiche parent | Carte migree |
| Messagerie provisoire | 4 indicateurs de demonstration | Migres, module toujours masque par feature flag en production |
| Portail parent | 6 KPI | Migration complete, portail toujours soumis a feature flag |
| Portail enseignant | 6 KPI | Migration complete, portail toujours soumis a feature flag |
| Inscriptions | liste, filtres et synthese textuelle | Pas de KPI artificiel ajoute sans donnee metier source |
| Absences / vie scolaire | listes et operations metier | Pas de KPI artificiel ajoute sans agregrat API fiable |
| Mosquee / portail eleve | placeholders desactives | Non exposes; aucune fausse donnee ajoutee |

Les graphiques reels trouves sont les barres verticales du dashboard et les tendances mensuelles horizontales des rapports. Il n'existe pas de bibliotheque de graphiques, de donut ou de courbe interactive dans le perimetre actuel.

## B. Hierarchie retenue

- Primaire : contexte de page et 2 a 4 KPI decisifs visibles immediatement.
- Secondaire : alertes, taches, tendances et syntheses apres le premier groupe KPI.
- Detail : listes et contenus metier conserves dans leurs sections existantes.
- Aucun KPI n'a ete invente pour les modules qui ne disposent pas d'un agregrat metier fiable.

## C. Primitives communes

- `ResponsiveKpiGrid` : grille 1 a 4 colonnes selon le contexte et les breakpoints R1.
- `ResponsiveKpiCard` : valeur, label, aide, icone, tonalite, tendance semantique, loading, empty et error.
- `ResponsiveDashboardCard` : header, titre, description, action et etats de contenu.
- `ResponsiveChartCard` : conteneur de graphique avec resume textuel accessible des valeurs.

`DashboardSection` n'a pas ete ajoute : les sections existantes ne partageaient pas assez de comportement pour justifier une abstraction supplementaire.

## D. Fichiers du LOT R5

Nouveaux :

- `Frontend/web-admin/src/shared/components/responsive-dashboard.tsx`
- `Frontend/web-admin/src/shared/components/responsive-dashboard.test.tsx`
- `Frontend/web-admin/src/shared/components/responsive-dashboard-contract.test.ts`
- `Frontend/web-admin/src/styles/responsive-dashboard.css`
- `Frontend/web-admin/public/fonts/manrope-latin-variable.woff2`
- `Frontend/web-admin/public/fonts/sora-latin-variable.woff2`
- `docs/audits/responsive-r5-dashboards.md`

Composants modifies :

- `Frontend/web-admin/src/features/dashboard-screen.tsx`
- `Frontend/web-admin/src/features/finance/finance-screen.tsx`
- `Frontend/web-admin/src/features/grades/grades-screen.tsx`
- `Frontend/web-admin/src/features/messages-screen.tsx`
- `Frontend/web-admin/src/features/parents/components/parents-list-section.tsx`
- `Frontend/web-admin/src/features/pilotage/pilotage-screen.tsx`
- `Frontend/web-admin/src/features/pilotage/pilotage-screen.test.tsx`
- `Frontend/web-admin/src/features/portal/portal-parent-screen.tsx`
- `Frontend/web-admin/src/features/portal/portal-teacher-screen.tsx`
- `Frontend/web-admin/src/features/reports/reports-screen.tsx`
- `Frontend/web-admin/src/features/rooms-screen.tsx`
- `Frontend/web-admin/src/features/teachers-screen.tsx`
- `Frontend/web-admin/src/features/teachers/components/teachers-list-section.tsx`
- `Frontend/web-admin/src/main.tsx`
- `Frontend/web-admin/src/shared/i18n.ts`
- `Frontend/web-admin/src/shared/i18n.test.tsx`

CSS modifies : `dashboard.css`, `erp-refinement.css`, `feature-foundation.css`, `features.css`, `globals.css`, `layout.css`, `mobile-product.css`, `pilotage.css`, `premium-v3-foundation.css`, `responsive-foundation.css`, `responsive.css`, `theme-overrides.css` et `utilities.css`.

## E. Petit mobile

- A 320 x 568, KPI empiles ou disposes par deux uniquement lorsque les valeurs restent lisibles.
- Valeurs et labels dimensionnes sans troncature opaque; les aides secondaires restent courtes.
- Aucun overflow document dans l'audit officiel.

## F. Mobile

- A 375, 390, 412 et 414 px, le dashboard utilise deux KPI compacts par ligne.
- L'ordre est contexte, KPI, taches/alertes, graphiques et syntheses.
- Les actions secondaires conservent des cibles tactiles et les cartes n'utilisent plus de hauteur rigide.

## G. Tablette

- Portrait : trois KPI par ligne lorsque la largeur le permet.
- Paysage : trois ou quatre colonnes selon le contenu, puis deux colonnes de synthese.
- Les compositions 768 x 1024, 820 x 1180, 1024 x 768, 1024 x 1366 et 1180 x 820 ont ete controlees sans grille desktop comprimee.

## H. Petit desktop

- De 1024 a 1279 px, les KPI passent a trois ou quatre colonnes selon le contexte.
- Les cartes de synthese utilisent la largeur disponible sans provoquer de scroll horizontal global.

## I. Desktop avant / apres

- A 1280 x 720 et 1440 x 900, ordre, densite, navigation et grammaire Premium V3 sont conserves.
- Les changements visibles se limitent a l'harmonisation des KPI et des headers de cartes.
- Aucune route, fonction, permission ou interaction metier n'a change.

## J. KPI avant / apres

- Avant : grilles et variantes propres a chaque module, hauteurs et espacements divergents.
- Apres : une grille canonique, des etats standardises et une densite mobile coherente.
- Les tendances positives, negatives et stables possedent un libelle semantique et une icone; la couleur n'est jamais l'unique information.

## K. Graphiques avant / apres

- Les graphiques CSS existants ont ete conserves, sans bibliotheque supplementaire.
- Leur hauteur mobile est bornee, les labels se replient proprement et les valeurs restent imprimees.
- Chaque carte graphique expose aussi un resume `<dl>` aux technologies d'assistance.
- Les graphiques ne sont pas interactifs; aucun faux tooltip n'a donc ete ajoute. Une future interaction tactile devra etre traitee avec le composant qui portera reellement les points interactifs.

## L. Longueur des pages

Captures finales a 414 px :

| Vue | Hauteur finale |
| --- | ---: |
| Dashboard | 1 654 px |
| Finance | 1 000 px |
| Notes | 896 px |
| Rapports | 1 058 px |
| Pilotage | 3 536 px |

L'audit initial global avait releve jusqu'a environ 4 805 px. Une mesure route par route strictement anterieure aux premiers changements R5 n'etait pas disponible; aucune valeur avant fictive n'est donc publiee. Pilotage reste la principale page longue et doit etre restructuree par domaine au R6 plutot que masquee arbitrairement.

## M. Premier ecran 390 x 844

Le dashboard montre le contexte de page, les quatre KPI principaux et le debut des taches prioritaires avant le premier scroll. Il n'est plus compose uniquement de titres, d'espaces ou de filtres.

## N. Accessibilite

- Titres et groupes KPI nommes; graphiques exposes avec `role="img"` et resume textuel.
- Tendances non dependantes de la couleur.
- Etats loading, empty et error annonces.
- Focus et cibles tactiles preserves par les fondations R1-R4.
- Zoom 200 % et `prefers-reduced-motion` valides par l'audit.

## O. RTL et i18n

- FR, EN et AR controles; ordre, alignements et espacements utilisent des proprietes logiques.
- Les derniers libelles Notes/Finance manquants ont ete ajoutes aux dictionnaires existants.
- La capture Notes/AR finale confirme le texte d'aide et les commandes en arabe.
- Aucune donnee metier libre n'est traduite automatiquement.

## P. Themes

Les memes structures et dimensions sont utilisees en clair et sombre; seules les couleurs des tokens changent. Les contrastes des barres, surfaces, bordures et textes restent lisibles dans les captures controlees.

## Q. Performance

- Aucune nouvelle dependance ou bibliotheque graphique.
- Datasets simples, calculs conserves localement et lazy loading existant preserve.
- Dimensions stables pour limiter les layout shifts.
- Manrope et Sora sont maintenant servies localement, supprimant le chargement Google Fonts et les erreurs reseau intermittentes de Chromium.

## R. Evolution de `!important`

- Avant : 1 085 occurrences.
- Apres : 1 080 occurrences.
- Evolution : -5; aucune nouvelle occurrence dans `responsive-dashboard.css`.

## S. Evolution CSS et bundles

| Mesure | Avant | Apres | Evolution |
| --- | ---: | ---: | ---: |
| CSS source | 579 096 o | 580 608 o | +1 512 o |
| CSS build | 451,04 kB | 452,84 kB | +1,80 kB |
| CSS gzip | 69,96 kB | 70,37 kB | +0,41 kB |
| JS principal | 431,02 kB | 438,60 kB | +7,58 kB |
| JS principal gzip | 125,45 kB | 127,49 kB | +2,04 kB |

La primitive partagee constitue un chunk de 2,83 kB, 0,99 kB gzip. La hausse JS principale vient surtout des traductions EN/AR ajoutees; aucune dependance n'a ete ajoutee.

## T. Validations executees

- Tests R5/i18n cibles : 3 fichiers, 28/28.
- Tests frontend complets : 34 fichiers, 188/188.
- Typecheck frontend : PASS.
- ESLint frontend : PASS.
- Build Vite avec origines API/storage explicites : PASS.
- Smoke frontend : PASS, 580 608 octets CSS et 1 080 `!important`.
- Test CSP : PASS.
- Audit visuel mocked CI final : 73/73, 0 constat.
- Audit visuel mocked complet final : 150/150, 0 constat.
- Console, pageerror, API inattendue, loading bloque et overflow : 0.
- Allowlist visuelle : vide.
- `git diff --check` : PASS.

Une tentative initiale a utilise par erreur le nom inexistant `visual:audit:ci`; elle a echoue avant tout test. La relance a utilise la commande officielle de la CI : `VISUAL_AUDIT_SCOPE=ci pnpm visual:audit:mocked`.

## U. Limites honnetes

- Les graphiques existants sont des visualisations CSS statiques, pas des series interactives avec tooltip.
- L'audit officiel execute ici est mocke et strict; l'audit integre avec backend reel n'etait pas requis pour ce lot frontend.
- Les donnees metier de demonstration limitent la validation de labels exceptionnellement longs.

## V. Dette restante R6-R10

- R6 : reduire la longueur de Pilotage par domaines et completer les syntheses metier uniquement avec des agregats fiables.
- R6 : traiter les incoherences fonctionnelles restantes des modules prioritaires, sans KPI fictifs.
- R7/R8 : poursuivre la couverture i18n de textes metier historiques hors ecrans controles.
- R9 : profiler les rerenders et le cout global du CSS, hors perimetre R5.
- R10 : rejouer l'audit integre contre une release candidate avec backend reel.

## W. Verdict R5

**GO pour commit.** Les KPI, cartes et graphiques audites sont responsives, accessibles et coherents sur les viewports obligatoires, sans regression visuelle relevee et sans modification backend ou metier.

## X. Recommandations exactes pour R6

1. Commencer par Pilotage, dont la hauteur mobile reste 3 536 px, et grouper ses domaines avec des resumes explicites.
2. Auditer Absences et Inscriptions avec les donnees API reelles avant d'ajouter d'eventuels KPI.
3. Conserver `ResponsiveKpiGrid`, `ResponsiveKpiCard` et `ResponsiveDashboardCard` comme seules primitives de synthese.
4. Ne pas activer Mosquee, Messagerie ou le portail eleve tant que leurs donnees et parcours ne sont pas reels.
5. Rejouer les memes viewports et le gate visuel strict apres chaque module R6.

## Y. Message de commit propose

`refactor(web-admin): make dashboards and KPI responsive`
