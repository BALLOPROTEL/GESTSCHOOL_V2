# LOT R9 - Performance frontend

Date de validation locale : 2026-08-13

## Périmètre et méthode

Le LOT R9 porte uniquement sur `Frontend/web-admin`, ses assets et ses scripts de mesure. Aucun contrat API, règle métier, dépendance, breakpoint, service externe ou configuration de déploiement n'a été modifié.

Les mesures ont été réalisées sur un build Vite local avec Chromium/Playwright et le protocole Chrome DevTools :

- desktop : 1440 x 900, sans throttling ;
- mobile : 390 x 844, sans throttling ;
- mobile contraint : 390 x 844, CPU x4, latence 150 ms, débit descendant 1,6 Mbit/s et montant 750 kbit/s ;
- API entièrement simulée et déterministe, sans appel externe ;
- routes : connexion, Dashboard, Élèves, Finance, Notes et Pilotage ;
- tables Élèves : 100 et 200 lignes sur desktop et mobile contraint.

Ces valeurs sont des mesures synthétiques locales, pas des données terrain ni un rapport Lighthouse. Le TTFB mesure uniquement le serveur Vite local. L'INP réel exige des interactions et des données utilisateurs en production ; le runner conserve une approximation Event Timing mais aucune interaction finale n'a dépassé son seuil de collecte.

Commandes reproductibles :

```bash
pnpm --filter @gestschool/web-admin build
pnpm performance:budget:web
PERFORMANCE_AUDIT_URL=http://127.0.0.1:5183 pnpm performance:audit:web
```

Les rapports détaillés restent sous `/tmp` et ne sont pas suivis par Git.

## Baseline et résultat

| Mesure | Avant R9 | Après R9 | Différence |
| --- | ---: | ---: | ---: |
| Modules Vite | 169 | 169 | 0 |
| Chunks JS | 32 | 32 | 0 |
| Chunks CSS | 3 | 3 | 0 |
| JS principal brut | 458 590 o | 458 805 o | +215 o |
| JS principal gzip | 133 739 o | 133 818 o | +79 o |
| JS total brut | 908 596 o | 908 832 o | +236 o |
| JS total gzip | 251 785 o | 251 875 o | +90 o |
| CSS principal brut | 456 103 o | 456 318 o | +215 o |
| CSS principal gzip | 70 924 o | 70 972 o | +48 o |
| CSS source | 584 970 o | 585 217 o | +247 o |
| `!important` | 1 080 | 1 080 | 0 |
| Médias statiques audités | 3 025 835 o | 167 381 o | -2 858 454 o (-94,5 %) |
| Image de connexion | 1 861 447 o PNG | 104 770 o WebP | -94,4 % |
| Logo principal | 549 793 o PNG | 11 062 o WebP | -98,0 % |
| Fonts locales | 50 120 o | 50 120 o | 0 |
| Requêtes API Dashboard | 16 | 16 | 0 |
| Ressources Dashboard desktop | 25 | 25 | 0 |
| Transfert Dashboard desktop | 827 023 o | 275 259 o | -66,7 % |
| Fenêtre API Dashboard mobile contraint | 1 496,7 ms | 915,9 ms | -38,8 % |
| CLS Dashboard mobile contraint | 0,196 | 0 | supprimé |
| LCP Dashboard mobile contraint | 3 812 ms | 3 624 ms | -188 ms |
| Tâches longues Dashboard mobile contraint | 1 797 ms | 1 416 ms | -381 ms |

Le JS et le CSS sont volontairement stables : le gain principal vient des assets, du parallélisme des appels indépendants et de la stabilité du fallback lazy. Les écarts temporels issus d'une exécution unique restent sensibles à la machine ; seuls les écarts structurels et les comparaisons exécutées avec le même runner sont considérés comme robustes.

## Core Web Vitals synthétiques finaux

| Parcours | Profil | FCP | LCP | CLS | TTFB local |
| --- | --- | ---: | ---: | ---: | ---: |
| Connexion | desktop | 380 ms | 1 260 ms | 0 | local |
| Dashboard | desktop | 740 ms | 940 ms | 0 | local |
| Connexion | mobile | 236 ms | non observé | 0 | local |
| Dashboard | mobile | 452 ms | 804 ms | 0 | local |
| Connexion | mobile contraint | 2 032 ms | 2 032 ms | 0 | local |
| Dashboard | mobile contraint | 2 976 ms | 3 672 ms | 0 | local |

Les parcours secondaires finaux restent sans overflow. Un CLS synthétique de `0,041` a été observé une fois sur Élèves mobile contraint ; les trois audits visuels officiels n'ont détecté aucun défaut structurel. Il reste à confirmer par plusieurs répétitions ou des données RUM au LOT R10.

## Bundle, routes et feature flags

- Toutes les grandes familles métier utilisent déjà `React.lazy` : IAM, Élèves, Parents, Enseignants, Finance, Notes, Vie scolaire, Référentiel, Pilotage, Rapports, Mosquée et portails.
- Les plus gros chunks secondaires restent Référentiel (47 194 o), Enseignants (44 641 o), Notes (40 890 o), Vie scolaire (33 192 o), Salles (30 837 o) et Finance (26 517 o).
- Aucune bibliothèque graphique, PDF ou éditeur lourd n'est une dépendance runtime ; les seules dépendances runtime directes sont React et React DOM.
- `studentPortal`, `mosquee`, `messages` et `userBilling` restent désactivés par défaut. Leurs chunks peuvent être émis par Vite, mais ne sont pas demandés au démarrage.
- Aucun `manualChunks`, prefetch global ou découpage en micro-chunks n'a été ajouté : les routes lazy existantes évitent déjà le coût initial sans créer de waterfall artificielle.
- `src/shared/i18n.ts` reste dans le chunk principal et représente environ 251 ko source. Son découpage asynchrone est reporté car il modifierait le contrat de traduction et présente un risque R8 disproportionné.

## Rendu React et appels API

- Les six chargeurs indépendants du bootstrap ADMIN démarrent maintenant ensemble avec `Promise.all`. Le nombre d'appels, les permissions et la fraîcheur restent inchangés.
- Un test vérifie que tous les chargeurs ont démarré avant la résolution du premier.
- `ResponsiveDataTable` ne recrée plus son `ResizeObserver` à chaque changement de `children`. Le test 100 vers 200 lignes vérifie une seule instance d'observer et borne les commits liés au calcul local du scroll.
- Aucun memo généralisé n'a été ajouté : les profils n'ont pas démontré d'autre rerender isolé dont le gain justifiait le risque.
- Les dashboards et graphiques utilisent les primitives locales, sans bibliothèque lourde ni animation ajoutée.

## Tables 100 et 200 lignes

Le benchmark final confirme un coût DOM linéaire :

| Cas | Nœuds DOM | Transition | Tâches longues cumulées |
| --- | ---: | ---: | ---: |
| Desktop, 100 lignes | 2 208 | 1 083 ms | 493 ms |
| Desktop, 200 lignes | 4 008 | 1 275 ms | 424 ms |
| Mobile contraint, 100 lignes | 2 187 | 3 430 ms | 2 939 ms |
| Mobile contraint, 200 lignes | 3 987 | 4 733 ms | 4 336 ms |

La variabilité d'une passe ne permet pas d'attribuer une amélioration au rendu des lignes. La virtualisation n'a pas été introduite : elle toucherait les 46 tableaux, la sémantique, le clavier et les garanties R8. La priorité R10 est d'abord de borner les volumes par pagination ; virtualiser seulement les vues qui dépassent encore les budgets après mesure.

## Images, fonts, CSS et cache

- Le fond de connexion est désormais WebP, sans dégradation visuelle constatée.
- Le logo utilise un WebP 256 x 221 ; favicon et icônes de langue/thème ont été redimensionnés à leur usage réel.
- Les images de l'interface ont des dimensions explicites ; le logo du drawer est chargé paresseusement.
- Manrope et Sora restent locales, une variable WOFF2 chacune, `font-display: swap`, et sont préchargées.
- Une hauteur minimale du fallback lazy réserve l'espace utile et supprime le déplacement du footer sur mobile.
- Une seule règle CSS a été ajoutée ; aucun breakpoint et aucun `!important` supplémentaire.
- Les chunks Vite sous `assets/` sont hashés. Les fichiers `public/` ne le sont pas : recommander `immutable` uniquement pour les assets hashés et une revalidation courte pour HTML, fonts et images publiques, sans modifier Vercel dans ce lot.
- Le budget automatisé bloque un JS initial gzip supérieur à 145 ko, un CSS initial gzip supérieur à 75 ko, un fond de connexion supérieur à 150 ko et un logo supérieur à 20 ko.

## Validations

- Tests R9 ciblés : 18/18.
- Tests frontend complets : 39 fichiers, 209/209.
- Typecheck, lint, build, smoke, CSP, scripts Node et `git diff --check` : réussis.
- Audit performance synthétique : 22/22, zéro erreur console/page/réseau et zéro overflow document.
- Audit visuel CI : 89/89, zéro constat.
- Audit responsive complet : 166/166, zéro constat.
- Audit accessibilité R8 : 135/135, zéro constat.
- Allowlist visuelle : vide.

## Fichiers du LOT R9

- Runtime et structure : `Frontend/web-admin/index.html`, `Frontend/web-admin/scripts/smoke-tests.mjs`, `Frontend/web-admin/src/app/App.tsx`, `Frontend/web-admin/src/app/use-app-bootstrap.ts`, `Frontend/web-admin/src/app/navigation/header-dropdown-menu.tsx`, `header-mobile-panel.tsx`, `header-navigation.tsx`, `header-utility-menu.tsx`, `Frontend/web-admin/src/features/auth-screen.tsx`, `Frontend/web-admin/src/shared/components/app-sidebar.tsx`, `responsive-data-table.tsx`, `Frontend/web-admin/src/styles/auth.css` et `layout.css`.
- Tests : `Frontend/web-admin/src/app/use-app-bootstrap.performance.test.tsx` et `Frontend/web-admin/src/shared/components/responsive-data-controls.test.tsx`.
- Assets : `anglais.png`, `arabe.png`, `favicon.png`, `france.png`, `mode-clair.png`, `mode-sombre.png`, ajout de `apple-touch-icon.png`, `logo.webp`, `page-de-connexion.webp`, retrait de `logo.png` et `pageDeConnexion.png`.
- Outils : `scripts/performance-audit-frontend.mjs`, `scripts/performance/check-frontend-bundle.mjs`, `scripts/performance/frontend-assets.test.mjs` et les deux commandes correspondantes dans `package.json`.
- Documentation : `docs/audits/responsive-r9-performance.md`.

Ce périmètre représente 31 entrées Git. Les changements Brevo/Render déjà présents avant R9 ne font pas partie de ce lot et n'ont pas été modifiés.

## Limites et dette R10

- Pas de Lighthouse installé et aucune donnée RUM : les valeurs locales ne sont pas des Core Web Vitals utilisateurs.
- INP terrain indisponible ; l'approximation locale n'a remonté aucun événement final au-dessus du seuil.
- Les tables non paginées de 100/200 lignes restent coûteuses, surtout sur mobile contraint.
- Le dictionnaire i18n demeure dans le chunk principal.
- Les headers de cache de la plateforme et le comportement réseau réel ne sont pas vérifiés sans déploiement.
- Les appels bootstrap sont parallèles mais restent nombreux ; leur consolidation requerrait une évolution backend hors R9.

Verdict R9 : **GO local**, avec dette explicite sur les grandes tables et mesures terrain à réaliser au LOT R10.

Message de commit proposé :

```text
perf(web-admin): optimize frontend loading and asset delivery
```
