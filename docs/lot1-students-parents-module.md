# Lot 1 - Dossier Eleve Et Module Parent

## Decision metier

- `Student` reste l'objet central du dossier eleve.
- Le parcours franco-arabe de l'eleve ne doit pas etre stocke comme un simple champ du dossier. La source de verite du cursus est `StudentTrackPlacement`, avec `Enrollment` conserve comme compatibilite legacy synchronisee.
- `Parent` est maintenant une personne metier distincte de `User`.
- `Parent.userId` est optionnel et sert uniquement a lier un parent metier a un compte portail.
- `ParentStudentLink` devient le lien parent-enfant metier. `parentUserId` reste optionnel pour compatibilite portail legacy.

## Migration legacy

La migration `20260411170000_students_parents_module` :

- enrichit `students` avec les champs administratifs manquants exposees par l'API;
- cree la table `parents`;
- rend `parent_student_links.parent_user_id` optionnel;
- ajoute `parent_student_links.parent_id` et les attributs metier du lien;
- regularise les liens legacy en creant une fiche `Parent` minimale pour chaque compte `User` parent deja lie;
- renseigne `relation_type` depuis `relationship`;
- copie `is_primary` vers `is_primary_contact`.

## Impact UI

- Le module `Eleves` affiche maintenant statut, cursus issus des placements, classe principale et responsables rattaches.
- Le module `Parents` gere les fiches parents, les comptes portail optionnels et les liens parent-enfant.
- L'ecran `Utilisateurs & droits > Liens portail legacy` ne cree plus de lien parent-eleve metier. Il garde uniquement une lecture/suppression des liens legacy et renvoie vers `Parents`.

## Regles implementees

- matricule eleve unique par etablissement logique `tenantId`;
- archivage logique eleve via `status=ARCHIVED`, `archivedAt` et `deletedAt` pour compatibilite legacy;
- parent metier actif obligatoire pour creer un lien;
- eleve non archive obligatoire pour creer un lien;
- doublon exact `parent + eleve + relationType` refuse cote service;
- un contact principal unique par eleve est maintenu quand `isPrimaryContact=true`;
- notifications et absences privilegient maintenant les coordonnees du parent metier, avec fallback vers le compte portail legacy.

## Points de vigilance

- `Enrollment` reste en compatibilite pendant la transition, mais les nouveaux ecrans doivent lire le cursus via `StudentTrackPlacement`.
- Depuis le lot 0, le portail parent resout d'abord `Parent.userId`, puis lit les enfants via `ParentStudentLink.parentId`. `parentUserId` reste uniquement une compatibilite de donnees legacy.
- Le test e2e local depend de Prisma schema-engine et de la base PostgreSQL locale; si `migrate deploy` echoue avant Jest, verifier l'environnement Prisma/DB avant de conclure a une regression applicative.

## Consolidation P1

- Le dossier eleve expose deja les champs administratifs, les placements `StudentTrackPlacement` et les responsables lies.
- Le module Parents expose deja la fiche parent metier, le compte portail optionnel et le lien parent-eleve enrichi.
- Le test e2e P1 verrouille maintenant le chemin transversal suivant : `Room` + `TeacherAssignment` -> `TimetableSlot.roomId/teacherAssignmentId` -> portail enseignant -> portail parent.
- Le portail eleve reste volontairement non finalise et extrait dans un ecran dedie pour eviter de continuer a gonfler `App.tsx`.
- Les prochains renforcements P1 doivent rester sur la consolidation : details, non-regressions et lisibilite, pas sur un nouveau module annexe.
