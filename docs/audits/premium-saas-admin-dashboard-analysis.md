# Audit visuel - Premium SaaS Admin Dashboard vers GestSchool V3

Date: 2026-06-01

## Objectif

Le template `Premium SaaS Admin Dashboard` devient la reference visuelle principale de GestSchool V3. Le but n'est pas de remplacer les routes, donnees, services et comportements GestSchool, mais de reduire au maximum les ecarts visibles: shell, sidebar, topbar, dashboard, cards, tables, filtres, formulaires, badges et densite.

## Sources analysees

- Template: `Premium SaaS Admin Dashboard/`
- GestSchool: `Frontend/web-admin/`
- Captures template: `/tmp/gestschool-template-screenshots/2026-06-01T18-54-18-093Z/`
- Captures GestSchool avant reprise phase 1: `/tmp/gestschool-v3-foundation-audit-2/2026-06-01T19-10-18-761Z/`

## Stack du template

- React + Vite 6.3.5.
- TypeScript/TSX.
- TailwindCSS 4.1 avec `@tailwindcss/vite`.
- `react-router` 7.13.0.
- `lucide-react` pour les icones.
- `recharts` pour les graphiques.
- Primitives shadcn/Radix UI, `class-variance-authority`, `tailwind-merge`.
- `sonner` pour les notifications.
- MUI est present mais n'est pas un prerequis visuel pour GestSchool.

Observation technique: les captures template remontent un warning React sur certains wrappers Radix/shadcn qui recoivent des refs sans `forwardRef`. Il ne faut donc pas copier les composants brutalement.

## Inventaire des ecrans template

| Route template | Role visuel | Elements UI principaux |
| --- | --- | --- |
| `/` Dashboard | Accueil operationnel | Shell clair, KPI cards, charts, activite recente, alertes. |
| `/students` Students | Liste dense | Header page, filtres, table, badges, dropdown actions. |
| `/students/:id` Student profile | Detail fiche | Header profil, tabs, cards de synthese. |
| `/enrollments` Enrollments | Workflow liste | KPI, filtres, table statut inscription. |
| `/finance` Finance | Liste comptable | KPI finance, filtres, table factures/paiements. |
| `/grades` Grades | Tableau large | Filtres, tabs, KPI, table notes. |
| `/attendance` Attendance | Suivi presence | KPI, chart, table presence. |
| `/settings` Settings | Parametres | Tabs, formulaires, switches, listes roles. |

## Inventaire GestSchool concerne

| GestSchool | Etat avant reprise | Priorite |
| --- | --- | --- |
| Shell global | Header global au-dessus du layout, sidebar sombre, densite differente. | P1 |
| Dashboard | Donnees bonnes, structure trop specifique GestSchool, pas assez template. | P1 |
| Eleves | Tables et formulaires existants, style a aligner. | P2 |
| Inscriptions | Workflow metier OK, style filtres/table a aligner. | P2 |
| Comptabilite | Donnees metier OK, table et KPI a rapprocher. | P2 |
| Notes & bulletins | Workflow fort, style a rapprocher prudemment. | P2 |
| Profil | Deja plus premium, mais shell doit converger. | P3 |
| Parametres | Partiellement placeholder, a traiter plus tard. | P4 |

## Mapping visuel template vers GestSchool

| Template | GestSchool cible | Decision |
| --- | --- | --- |
| `Layout.tsx` shell `flex h-screen` | `App.tsx` shell | Deplacer le header dans la colonne principale et rendre la sidebar pleine hauteur. |
| Sidebar `w-64 bg-white border-r` | `AppSidebar` | Ajouter logo haut, navigation centre, user card bas. |
| Header `h-16 bg-white border-b px-6` | `HeaderNavigation` | Retirer visuellement la marque desktop, garder recherche/actions/profil. |
| Page content `p-6 space-y-6` | `.app-shell-content` | Zone scroll dediee avec padding 24px et gap 24px. |
| Cards `bg-white border rounded-xl shadow-sm` | `.panel`, `.kpi-card`, `.dashboard-panel-shell` | Radius 12px, border `#e2e8f0`, ombre discrete. |
| KPI card header + icon right | `DashboardScreen` | Modifier markup KPI pour titre + icone + valeur + hint. |
| Recent activity / alert panels | Dashboard actions/alertes | Conserver actions reelles, presenter comme listes cards compactes. |
| Tables shadcn | `.table-wrap` | A faire en phase 2: header clair, hover, actions compactes. |
| Badges shadcn | `.status-pill` | Palette deja rapprochee, a normaliser par module. |
| Forms/selects | formulaires existants | A faire phase 2/3 sans casser validations. |

## Ecarts majeurs avant phase 1

1. Shell global: GestSchool avait le header au-dessus de tout, alors que le template a sidebar pleine hauteur + header dans la colonne principale.
2. Sidebar: GestSchool affichait une sidebar sombre, dense, sans logo ni profil bas dans le panneau. Template: sidebar blanche, `w-64`, logo haut, user card bas.
3. Topbar: GestSchool avait une topbar visuellement plus custom, arrondie et flottante. Template: barre simple blanche, hauteur 64px, border bottom.
4. Dashboard: GestSchool n'avait pas le header de page du template et les KPI avaient des barres de progression artificielles.
5. KPI cards: GestSchool utilisait une grammaire "ERP dark/cyan". Template: label + icon gray + value + delta/hint, blanc.
6. Actions: GestSchool avait des lignes deja corrigees mais encore trop proches de son systeme interne. Template: cards blanches simples, espacements 16px.
7. Spacing: GestSchool avait des paddings et gutters variables. Template: `p-6`, `gap-4`, `gap-6`, hauteur header stable.
8. Typography: GestSchool utilisait des contrastes et poids tres appuyes. Template: poids 500/600/700, texte slate.

## Deja conforme ou recuperable

- Donnees metier et routes: a conserver.
- Lazy loading et separation des ecrans: conforme a une architecture maintenable.
- Tests et smoke checks: bonne base de securite.
- Table wrappers, status pills et panels existants: reutilisables avec une couche V3 plus stricte.
- Profil utilisateur: visuellement plus proche que les anciens modules, mais beneficie du shell V3.

## Phase 1 implementee

### Shell global

- `App.tsx`: le header est maintenant rendu dans `.app-shell-main`, apres la sidebar, comme dans le template.
- `App.tsx`: ajout de `.app-shell-content`, zone scroll dediee pour le contenu, avec padding et gap type template.
- `AppSidebar`: ajout d'un brand block en haut avec logo et nom d'ecole.
- `AppSidebar`: ajout d'une user card en bas avec avatar/initiales, nom et email/role.
- CSS V3: sidebar blanche pleine hauteur, `16rem`, border-right, nav compact, actif bleu.
- CSS V3: topbar blanche `4rem`, border-bottom, recherche compacte, actions a droite.

### Dashboard

- `DashboardScreen`: ajout d'un header de page `Tableau de bord` + sous-titre contextuel.
- `DashboardScreen`: KPI cards restructures en label + icone + valeur + hint.
- Suppression visuelle des barres de progression artificielles sur les KPI.
- Ajout d'une rangee analytique proche du template: panneau `Recouvrement & encaissements` et panneau `Suivi operationnel`.
- Les graphiques utilisent uniquement les donnees existantes (`RecoveryDashboard` et KPI visibles). Quand une donnee n'existe pas, l'interface affiche une indisponibilite explicite au lieu d'inventer un chiffre.
- Dashboard grid rapprochee du template: KPI en 4 colonnes desktop, deux panneaux analytiques, puis actions/alertes.
- Actions et alertes conservent les donnees existantes, sans mock.

### Styles

- `premium-v3-foundation.css`: passage d'une simple fondation cosmetique a une couche structurelle stricte pour shell + dashboard.
- Masquage visuel du bandeau local preview et de l'ancien contexte `Module actif` dans le shell V3, car ils n'existent pas dans le template et creaient des barres parasites.
- Aucun ajout de dependance.
- Aucun remplacement de donnees par les mocks du template.
- Aucun changement API.

## Captures

Template:

- `/tmp/gestschool-template-screenshots/2026-06-01T18-54-18-093Z/desktop-dashboard.png`
- `/tmp/gestschool-template-screenshots/2026-06-01T18-54-18-093Z/desktop-students.png`
- `/tmp/gestschool-template-screenshots/2026-06-01T18-54-18-093Z/desktop-finance.png`
- `/tmp/gestschool-template-screenshots/2026-06-01T18-54-18-093Z/desktop-grades.png`
- `/tmp/gestschool-template-screenshots/2026-06-01T18-54-18-093Z/desktop-settings.png`

GestSchool avant reprise phase 1:

- `/tmp/gestschool-v3-foundation-audit-2/2026-06-01T19-10-18-761Z/dashboard-desktop-light.png`
- `/tmp/gestschool-v3-foundation-audit-2/2026-06-01T19-10-18-761Z/profile-desktop-light.png`

GestSchool apres phase 1:

- `/tmp/gestschool-template-fidelity-phase1/2026-06-01T20-18-37-505Z/dashboard-desktop-light.png`
- `/tmp/gestschool-template-fidelity-phase1/2026-06-01T20-18-37-505Z/dashboard-mobile-light.png`
- `/tmp/gestschool-template-fidelity-phase1/2026-06-01T20-18-37-505Z/students-desktop-light.png`
- `/tmp/gestschool-template-fidelity-phase1/2026-06-01T20-18-37-505Z/finance-desktop-light.png`
- `/tmp/gestschool-template-fidelity-phase1/2026-06-01T20-18-37-505Z/profile-desktop-light.png`

## Mesure qualitative de proximite

| Ecran | Avant reprise | Apres phase 1 cible |
| --- | --- | --- |
| Shell global | 35%: couleurs proches, structure differente. | 75%+: meme structure sidebar/header/content. |
| Dashboard | 40%: cards blanches mais layout GestSchool. | 78%: header, KPI, panneaux analytiques, actions/alertes proches, donnees reelles conservees. |
| Listes | 35%: style global rapproche mais tables non refaites. | 50%: shell conforme, contenus metier encore a rapprocher en phase 2. |
| Details/formulaires | 45% sur Profil, plus faible ailleurs. | Phase 3. |
| Parametres | 25%: placeholders et structure non alignes. | Phase 4. |

## Reste a faire pour fidelite maximale

1. Pages listes: Eleves, Inscriptions, Finance, Notes & bulletins.
2. Tables: header, density, actions dropdown/ghost, empty states.
3. Filtres: barre compacte, selects style template, boutons reset/action.
4. Tabs: rapprocher des tabs shadcn du template.
5. Formulaires: labels, inputs, sections, aides, erreurs.
6. Badges: normalisation globale par statut.
7. Charts: uniquement si de vraies donnees API existent.
8. Parametres: reprendre structure tabs/cards du template en conservant permissions.

## Non integre volontairement

- Donnees mockees du template.
- Routes demo du template.
- `recharts` tant qu'aucune donnee dashboard fiable n'exige un graphique.
- MUI.
- Composants shadcn/Radix copies tels quels.
- Actions destructives de demo.
