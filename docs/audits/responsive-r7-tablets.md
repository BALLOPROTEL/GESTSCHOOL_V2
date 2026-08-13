# LOT R7 - Tablettes et ecrans intermediaires

## Verdict

GO pour commit. La tranche 768-1279 px dispose d'un rail tablette stable, d'une sidebar
compacte lisible et de tables denses a scroll local. Les audits officiels CI, responsive et R7
sont verts sans allowlist, overflow document, erreur API, console ou pageerror.

## A-D. Perimetre et diagnostic initial

Ecrans audites: Dashboard, IAM, Eleves, Parents, Enseignants, Inscriptions, Finance, Notes et
bulletins, Absences, Emploi du temps, Salles, Referentiel, Pilotage, Rapports et conformite,
Notifications, Profil, Preferences et Journal d'activite.

| Zone | Diagnostic initial | Cause | Resultat R7 |
| --- | --- | --- | --- |
| 768-1023 | 0 overflow document; rail 76 px et contenu stables | Fondations R1-R6 saines | Conserve et couvert par la matrice R7 |
| 1024-1279 FR | `Rapports & conformite` tronque a 150/133 px | Espacement interne desktop conserve dans 224 px | 151/151 px, sans elargir la sidebar |
| 1024-1279 AR | Deux labels tronques a 168/151 et 160/151 px | Texte arabe plus long force sur une ligne | Retour a la ligne local, 151/151 px |
| Tables | Seuils historiques 760/761/1180 | Strategie R4 non alignee sur les bornes R1 | Seuils 767/768/1279, scroll toujours local |

Portrait et paysage n'avaient aucun debordement structurel. Les variations observees sont des
recompositions par largeur: rail jusqu'a 1023 px, sidebar 224 px de 1024 a 1279 px, sidebar
desktop 256 px a partir de 1280 px.

## E-G. Shell, rail et sidebar compacte

- Le rail reste exactement a 76 px entre 768 et 1023 px, avec drawer complet, focus restaure,
  cibles tactiles 44 px et contenu `min-width: 0`.
- La sidebar compacte reste exactement a 224 px entre 1024 et 1279 px.
- Les paddings et gaps compacts sont portes par des tokens communs, pas par page.
- Les labels longs utilisent deux lignes si necessaire; aucune taille de police n'est reduite.
- Le desktop reste a 256 px. Aucun breakpoint global n'est ajoute.

## H-R. Modules metier

- Dashboard: grille KPI intermediaire R5 preservee; 3 colonnes en tablette et 4 en compact.
- IAM, Eleves, Enseignants, Inscriptions, Finance, Notes, Absences, Salles et Referentiel:
  `ResponsiveDataTable` reste l'unique primitive, premiere colonne defilante et actions stables.
- Parents, Notifications, Profil et Preferences: formulaires R3 conserves en drawer jusqu'a
  1023 px puis inline a partir de 1024 px.
- Emploi du temps: liste et semaine restent disponibles en tablette; aucune vue n'est reduite.
- Pilotage: KPI, actions et disclosures R6 conservent leur composition sans page artificiellement
  allongee ni carte etroite.
- Rapports/conformite et Journal d'activite: densite compacte et scroll local verifies.
- Portails enseignant/parent: hors session administrateur et couverts par leurs tests de role.
- Portail eleve et Mosquee: flags de production desactives; aucun placeholder n'a ete active.

## S-U. Tabs, formulaires et tables

- Les tabs et `.workflow-navigation` restent bornes a leur conteneur; l'onglet actif demeure
  visible et le scroll horizontal est local.
- Les drawers ont une largeur confortable en tablette, un footer sticky et un focus contenu.
- A partir de 1024 px les formulaires redeviennent inline sans modalite artificielle.
- Les 46 tables metier restent declarees via `ResponsiveDataTable`.
- Les indices de scroll sont disponibles jusqu'a 1279 px; aucun scroll local n'est transmis au
  document.

## V-Z. RTL, themes, interactions et transitions

- FR couvre la matrice complete. EN et AR couvrent Dashboard, IAM, Finance, Referentiel,
  Emploi du temps et Pilotage.
- RTL utilise les proprietes logiques existantes; le cas AR sombre 1180x820 mesure 1180/1180
  pour le document et 151/151 pour tous les labels de navigation.
- Clair/sombre, clavier, Escape, restauration du focus, tactile et souris sont couverts par les
  contrats R2-R6 et les parcours R7.
- Le zoom 200 % est simule par les viewports CSS equivalents 384x512, 512x384 et 590x410;
  aucun contenu critique n'est coupe.
- 767/768, 1023/1024 et 1279/1280 changent de mode de shell sans overflow ni largeur hors
  viewport. Le changement de largeur de navigation est volontaire et tokenise.

## AA-AC. Metriques avant/apres

| Mesure | Avant R7 | Apres R7 | Evolution |
| --- | ---: | ---: | ---: |
| Overflows document | 0 | 0 | 0 |
| Anomalies produit 768-1023 | 0 | 0 | 0 |
| Anomalies produit 1024-1279 | 3 labels distincts | 0 | -3 |
| `!important` | 1 080 | 1 080 | 0 |
| CSS source | 584 698 o | 584 976 o | +278 o |
| Lignes CSS | 25 445 | 25 476 | +31 |
| CSS build global | 455,49 kB | 456,12 kB | +0,63 kB |
| CSS build gzip | 70,81 kB | 70,90 kB | +0,09 kB |
| Nouveaux composants React | 0 | 0 | 0 |
| Nouvelles regles tablette | 0 | 1 partagee + 3 tokens | ciblees |

Le budget smoke de 585 000 octets reste bloque et n'a pas ete releve.

## AD-AF. Tests et audits

- Tests R7 cibles: 14/14 PASS.
- Tests frontend complets: 36 fichiers, 197 tests, PASS.
- Typecheck et lint frontend: PASS.
- Build frontend: PASS.
- Smoke frontend: PASS, 584 976 octets et 1 080 `!important`.
- CSP: 1/1 PASS; collecteur visuel: 6/6 PASS; TLS local: 1/1 PASS.
- Audit R7 officiel: 155/155, zero constat.
- Audit CI officiel: 89/89, zero constat.
- Audit responsive complet: 166/166, zero constat.
- Allowlist: vide.

## AG-AJ. Limites et suites

- Les audits utilisent les fixtures API officielles; l'audit integre avec backend reel reste a
  rejouer au lot final.
- Le zoom est un equivalent Playwright en pixels CSS, pas le zoom de l'interface Chrome.
- Les donnees de fixtures ne representent pas tous les textes libres ou volumes de production.
- R8: audit final accessibilite et i18n, y compris navigation clavier exhaustive par role.
- R9: profiler les rerenders et le cout des grands tableaux sans changer le rendu.
- R10: rejouer la matrice avec API, PostgreSQL, Redis et stockage de recette.

## AK. Message de commit propose

`refactor(web-admin): optimize tablet and intermediate layouts`
