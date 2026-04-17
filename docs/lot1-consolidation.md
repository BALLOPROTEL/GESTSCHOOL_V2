# Lot 1 - Consolidation Produit

## Objectif

Lot 1 renforce les modules deja presents apres la stabilisation P0. Il ne lance pas de nouveau domaine metier : il verrouille les flux Eleves/Parents, Enseignants/Salles, portails et emploi du temps.

## Sources de verite retenues

| Flux | Source de verite P1 | Compatibilite encore toleree |
| --- | --- | --- |
| Cursus eleve | `StudentTrackPlacement` | `Enrollment` reste synchronise pour les anciens flux. |
| Parent metier | `Parent` | `User` sert uniquement au compte portail. |
| Lien parent-enfant | `ParentStudentLink.parentId` | `parentUserId` reste un pont legacy non prioritaire. |
| Affectation enseignant | `TeacherAssignment` | `TeacherClassAssignment` reste inventorie, pas utilise par les portails. |
| Salle emploi du temps | `TimetableSlot.roomId` vers `Room` | `TimetableSlot.room` reste un libelle de compatibilite. |
| Enseignant emploi du temps | `TimetableSlot.teacherAssignmentId` vers `TeacherAssignment` | `teacherName` reste un libelle de compatibilite. |

## Consolidations effectuees

- Test e2e transversal ajoute : creation d'une salle, creation d'une affectation pedagogique enseignant, creation d'un creneau d'emploi du temps avec `roomId` et `teacherAssignmentId`, puis verification dans les portails enseignant et parent.
- Nettoyage e2e renforce : les tables Salles (`roomAvailability`, `roomAssignment`, `room`, `roomType`) sont purgees dans le bon ordre pour eviter des restes de tests.
- Frontend : le placeholder du portail eleve est extrait de `App.tsx` dans un ecran dedie. Il reste explicitement non finalise.
- Documentation : le lot Eleves/Parents est aligne avec la decision P0 qui fait de `Parent.userId` le rattachement portail principal.

## Backlog volontairement reporte

- Pas de backend de messagerie dans P1.
- Pas de portail eleve production dans P1.
- Pas de suppression physique des champs legacy `room`, `teacherName`, `Enrollment` ou `parentUserId` tant que les inventaires DB ne sont pas verifies en staging.
- Pas de refactor massif de `App.tsx` : le decoupage doit rester progressif et teste.

## Verification attendue

```powershell
pnpm --filter @gestschool/api build
pnpm --filter @gestschool/web-admin build
pnpm --filter @gestschool/api test:e2e
```

Si `test:e2e` echoue avec une erreur de connexion PostgreSQL locale, relancer apres demarrage de la base ou sur staging. Ce cas ne doit pas etre interprete comme une regression applicative.
