# LOT R8 - Accessibilité, i18n, RTL, thèmes et zoom

Date de validation : 2026-08-13

## Périmètre

Audit transversal du frontend `web-admin` uniquement. Les 18 parcours officiels ont été vérifiés : Dashboard, IAM, Enseignants, Élèves, Inscriptions, Finance, Notes, Absences, Salles, Emploi du temps, Notifications, Référentiel, Pilotage, Parents, Rapports, Profil, Préférences et Activité.

Aucun changement backend, API, RBAC, métier, dépendance, Render ou Vercel n'a été effectué.

## Diagnostic et corrections

- Navigation clavier : les panneaux du header gèrent désormais le focus initial, `Escape`, la restauration du focus et les touches `ArrowUp`, `ArrowDown`, `Home` et `End`.
- Drawer : piège de focus, fermeture `Escape`, restauration au déclencheur et nettoyage sous React Strict Mode renforcés.
- Navigation de workflow : tab stop mobile, `Home`/`End` et flèches tenant compte du RTL.
- Sémantique : noms accessibles des panneaux, rôles des menus, description conditionnelle du scroll local des tableaux et libellé accessible de l'upload d'avatar.
- Toasts : conservation de `aria-live` et direction `dir` cohérente avec FR/EN/AR.
- Formulaires : 51 libellés du Référentiel sont traduits déclarativement et l'astérisque obligatoire est masqué aux technologies d'assistance.
- i18n : suppression des sorties brutes relevées dans IAM, Référentiel, Notes, Vie scolaire, menus et puces d'état. Un garde statique couvre les chaînes littérales visibles de IAM et du Référentiel.
- Touch : 61 occurrences de cibles inférieures à 44 px détectées au fil des passes ont été ramenées au minimum GestSchool de 44 px, sans nouveau breakpoint ni `!important`.
- Reduced motion : le contrat navigateur vérifie les transitions visibles des parcours Dashboard, Finance et Emploi du temps avec `prefers-reduced-motion: reduce`.
- Thèmes et RTL : les variantes clair/sombre et les contrôles AR/RTL font partie des matrices officielles.

Les données métier libres, les identifiants techniques et le nom de l'établissement ne sont volontairement pas traduits.

## Méthode zoom et accessibilité

Le zoom automatisé utilise le Chrome DevTools Protocol `Emulation.setDeviceMetricsOverride` avec `deviceScaleFactor=2` et une surface CSS divisée par deux. Cela vérifie le reflow à l'équivalent 200 % sans se limiter à réduire le viewport, mais ne remplace pas une recette avec le zoom UI du navigateur et un lecteur d'écran réel.

Le dépôt ne contient pas `axe-core`. Le contrôle automatisé R8 couvre les noms accessibles, labels, images, dialogs, tableaux, tabs, cibles tactiles, focus, reduced motion, RTL, débordements, erreurs console/page et appels API. Le contraste WCAG chiffré et le comportement avec NVDA/VoiceOver restent à certifier manuellement au LOT R10.

## Tests et résultats

- Tests ciblés R8 : réussis.
- Tests frontend : 38 fichiers, 207 tests réussis.
- Typecheck frontend : réussi.
- ESLint frontend : réussi.
- Build production avec origines CI explicites : réussi.
- Smoke frontend : réussi.
- Test CSP : 1/1 réussi.
- Lint des scripts visuels : réussi.
- Audit R8 : 135/135 workflows, 0 constat.
- Audit visuel CI : 89/89 workflows, 0 constat.
- Audit responsive complet : 166/166 workflows, 0 constat.
- Erreurs API imprévues : 0.
- Erreurs console : 0.
- `pageerror` : 0.
- Overflow document : 0.
- Allowlist : vide.

## Métriques CSS

| Mesure | Avant R8 | Après R8 |
| --- | ---: | ---: |
| CSS source | 584 976 octets | 584 970 octets |
| Lignes CSS | 25 447 | 25 451 |
| `!important` | 1 080 | 1 080 |
| Bundle CSS principal | 456,12 kB | 456,10 kB |
| Bundle CSS principal gzip | 70,90 kB | 70,92 kB |

Aucun `overflow-x: hidden/clip` racine, breakpoint hors standards ou nouvel `!important` n'a été ajouté.

## Verdict

**GO LOT R8**, avec deux limites explicites à reprendre pour la certification finale : mesure automatisée exhaustive des contrastes et recette sur technologies d'assistance réelles. Les audits ont utilisé les fournisseurs API mockés stricts ; le parcours intégré avec backend réel reste au LOT R10.

Message de commit proposé :

```text
fix(web-admin): harden accessibility and multilingual UI
```
