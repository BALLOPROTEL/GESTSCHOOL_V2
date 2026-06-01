# Audit - Premium SaaS Admin Dashboard

Date: 2026-06-01

## Synthese

Le dossier `Premium SaaS Admin Dashboard` est un template React/Vite propre visuellement, utile comme reference de rendu pour GestSchool V3. Il ne doit pas remplacer GestSchool: il contient des routes, donnees mockees et composants de demonstration. La bonne approche consiste a reprendre ses tokens, sa densite de layout, ses cards, tables, badges et formulaires, puis les appliquer aux composants metier existants.

## Stack Identifiee

- React avec Vite 6.3.5.
- TypeScript/TSX.
- TailwindCSS 4.1 via `@tailwindcss/vite`.
- `react-router` 7.13.0.
- `lucide-react` pour les icones.
- `recharts` pour les graphiques.
- Composants shadcn/Radix UI, `class-variance-authority`, `tailwind-merge`.
- `sonner` pour les notifications.
- MUI est present dans les dependances mais ne semble pas indispensable aux ecrans observes.

Le build du template passe, avec un avertissement de gros bundle JS. Les captures locales ont aussi remonte un warning React sur certains composants shadcn/Radix: des composants fonctionnels recoivent des refs. Il faut donc eviter une copie brute des composants.

## Arborescence Utile

- `src/main.tsx`: entree React.
- `src/app/App.tsx`: declaration des routes.
- `src/app/components/Layout.tsx`: shell principal, sidebar et header.
- `src/app/pages/*.tsx`: pages metier de demonstration.
- `src/app/components/ui/*.tsx`: primitives shadcn.
- `src/styles/theme.css`: design tokens.
- `src/styles/tailwind.css`, `globals.css`, `index.css`, `fonts.css`: styles globaux.

## Ecrans Principaux

- Dashboard: KPI, graphiques, activite recente, alertes.
- Students: liste eleves, filtres, table, actions.
- Student profile: fiche eleve, onglets academique/inscription/finance/assiduite.
- Enrollments: inscriptions, statuts, filtres.
- Finance: KPIs financiers, factures, paiements.
- Grades: notes, bulletins, filtres, tableau large.
- Attendance: presence, indicateurs, graphique, table.
- Settings: informations ecole, configuration academique, utilisateurs, roles, notifications, billing.

## Captures Locales

Le template a ete lance localement sur `http://127.0.0.1:5190`. Les captures desktop et mobile sont disponibles ici:

`/tmp/gestschool-template-screenshots/2026-06-01T18-54-18-093Z/`

Captures generees:

- `desktop-dashboard.png`
- `desktop-students.png`
- `desktop-student-profile.png`
- `desktop-enrollments.png`
- `desktop-finance.png`
- `desktop-grades.png`
- `desktop-attendance.png`
- `desktop-settings.png`
- equivalents mobile pour les memes ecrans.

## Elements Reutilisables Dans GestSchool

- Layout global: shell clair, sidebar blanche, header blanc compact, main scrollable.
- Sidebar: navigation par sections, actif bleu, icones compactes, separations discretes.
- Header: recherche centrale, actions a droite, profil utilisateur compact.
- Cards: fond blanc, border `#e2e8f0`, radius `0.75rem`, ombre tres douce.
- Tables: header gris tres leger, hover subtil, actions compactes.
- Badges: statuts arrondis, couleurs fonctionnelles et calmes.
- Tabs et filtres: controles denses, lisibles, focus ring bleu.
- Forms: champs blancs, border neutre, radius `0.5rem`.
- Design tokens: fond `#f8fafc`, texte `#0f172a`, muted `#64748b`, primaire `#2563eb`.
- Spacing: page aeree mais compacte, cards secondaires en grille.

## A Ne Pas Integrer Tel Quel

- Donnees mockees des pages.
- Routes de demonstration du template.
- Logique de suppression directe visible dans les actions de demo.
- Graphiques `recharts` sans vraie source API.
- MUI si aucun composant GestSchool ne l'exige.
- Composants shadcn/Radix sans correction des refs.
- Logique `BrowserRouter` du template, incompatible avec le shell GestSchool existant.
- Pages Settings/Billing demo qui ne refletent pas encore les permissions GestSchool.

## Mapping Template Vers GestSchool

| Template | GestSchool cible | Strategie |
| --- | --- | --- |
| `Layout.tsx` | `HeaderNavigation`, `AppSidebar`, shell App | Reprendre le rendu via CSS, pas la structure route. |
| `Card` shadcn | `.panel`, `.card-panel`, `.module-modern` | Mapper tokens/radius/shadow dans une couche CSS. |
| Tables shadcn | `.table-wrap` existant | Harmoniser header, hover, border et actions. |
| Badges | `.status-pill` | Conserver classes metier, remplacer palette. |
| Forms/selects | formulaires existants | Harmoniser radius, focus, fonds. |
| Charts | Pilotage/Dashboard plus tard | Ne lier qu'a de vraies donnees API. |
| Demo pages | modules GestSchool | Aucun remplacement direct. |

## Plan D'integration

1. Poser une couche de fondation visuelle V3, importee en dernier, qui mappe les tokens du template aux classes GestSchool existantes.
2. Stabiliser sidebar/header en clair sans modifier leur logique de navigation.
3. Refondre progressivement les primitives existantes: cards, tables, badges, tabs, forms.
4. Reprendre ecran par ecran avec priorite client: Dashboard, Profil, Pilotage, Eleves, Notes/Bulletins, Finance.
5. Ajouter les graphiques uniquement la ou une vraie API fournit la donnee.
6. Ajouter une recette visuelle automatisee apres chaque gros module.
7. Supprimer progressivement les styles globaux redondants une fois les modules stabilises.

## Premier Changement Applique

Une premiere fondation CSS a ete ajoutee dans:

`Frontend/web-admin/src/styles/premium-v3-foundation.css`

Elle est importee apres `erp-refinement.css` pour reprendre le rendu clair premium du template sans toucher aux composants metier, routes, services API ou donnees.
