# LOT I5 - Scolarite, classe, cursus et placement academique

Date de validation locale : 2026-08-23

Perimetre : backend NestJS/Prisma et PostgreSQL local jetable. Aucun frontend,
aucune Finance, aucune migration et aucune operation de production.

## A. Modele academique reel

Le modele conceptuel demande `SchoolYear -> Cycle -> Track -> Level -> Class`.
Le modele reel ne contient pas de table `Track`. `AcademicTrack` est un enum
(`FRANCOPHONE`, `ARABOPHONE`) porte a la fois par `Level`, `Classroom`,
`StudentTrackPlacement` et `Enrollment`.

La chaine relationnelle effective est donc :

`SchoolYear -> Cycle -> Level(track) -> Classroom(track)`.

Le cursus/parcours presente au futur utilisateur correspond a `AcademicTrack`.
Le cycle reste une donnee structurelle derivee du niveau choisi ; il n'a pas a
etre un choix autonome dans le parcours novice.

## B. SchoolYear

- Une admission accepte uniquement une annee `status=ACTIVE` et
  `is_active=true` du tenant courant.
- La politique produit reste `SINGLE_ACTIVE` : zero annee bloque les admissions
  et plusieurs annees actives constituent une incoherence bloquante.
- Cette politique est coherente avec `ReferenceSchoolYearsService`, qui
  desactive les autres annees lors de l'activation d'une annee.
- Les annees `DRAFT`, futures non activees et `CLOSED` ne sont pas utilisables.
- La meme politique s'applique a `NEW_ADMISSION` et `RE_ENROLLMENT`.

## C. Cycle

Le cycle appartient a un tenant et a une annee. Il doit etre `ACTIVE`. Son ID
est conserve dans le brouillon afin de figer le contexte, mais il est derive du
niveau retourne par l'API et revalide, pas choisi arbitrairement.

## D. Track / cursus

`AcademicTrack` est le cursus canonique. Il n'a ni ID ni table propre. L'API
utilise donc le parametre `track` et non un faux `trackId`. Un cursus n'est
propose que s'il possede au moins un niveau actif dans un cycle actif de
l'annee selectionnee.

## E. Level

Le niveau doit appartenir au tenant, au cycle selectionne, au cursus selectionne
et a un cycle actif de l'annee active. Un niveau inactif ou croise avec un autre
tenant retourne `LEVEL_NOT_AVAILABLE` sans reveler son existence.

## F. Class

La classe doit etre `ACTIVE` et correspondre simultanement au tenant, a l'annee,
au niveau et au cursus. Le niveau et son cycle sont egalement revalides. Une
classe archivee logiquement par statut reste consultable dans l'historique mais
n'est plus proposable pour une nouvelle admission.

## G. Relations canoniques

`StudentTrackPlacement` reste la source canonique. PostgreSQL impose l'unicite
`(tenant_id, school_year_id, student_id, track)`. `Enrollment` reste le miroir
legacy avec la meme portee d'unicite et est cree dans la transaction I3.

Les FK PostgreSQL inspectees sont simples (IDs) et non composites avec le
tenant. L'isolation inter-tenant repose donc aussi sur la politique applicative
centralisee et ses tests. Aucune contrainte structurante n'a ete modifiee en I5.

## H. Endpoint d'options academiques

Endpoint ajoute :

`GET /api/v1/admission-cases/academic-options`

Filtres progressifs :

1. aucun filtre : annees utilisables uniquement ;
2. `schoolYearId` : cursus disponibles ;
3. `schoolYearId + track` : niveaux disponibles avec leur cycle ;
4. ajout de `levelId + cycleId` : classes compatibles uniquement.

Le payload ne retourne pas tout le referentiel et n'expose aucune ressource
d'un autre tenant.

## I. Validation progressive

`AdmissionAcademicPolicyService` est la source de verite unique. Il fournit :

- le catalogue compact pour les prerequis ;
- les options progressives ;
- la validation du brouillon au PATCH ;
- le calcul de coherence pour la readiness ;
- la revalidation transactionnelle au finalize ;
- la validation utilisee par la creation stricte du placement.

Un filtre ou un brouillon saute une etape renvoie
`ACADEMIC_CONTEXT_INVALID`.

## J. Auto-selections

Le contrat declare explicitement :

- `automaticStudentSelection=false` ;
- `automaticClassSelection=false`.

Une annee active unique peut etre preaffichee par le futur frontend, mais aucune
classe, aucun niveau et aucun eleve ne sont confirmes silencieusement.

## K. AdmissionCase ACADEMICS

Les UUID sont controles par les DTO. Le PATCH valide ensuite les relations, les
statuts et le tenant. Une selection incoherente n'est pas persistee comme
`READY`.

## L. Readiness

La section est complete seulement lorsque les cinq valeurs sont presentes et
coherentes : `schoolYearId`, `cycleId`, `track`, `levelId`, `classId`.
La readiness reutilise le catalogue de la politique academique. Finance reste
hors du critere bloquant I5.

## M. Revalidation finalize

La selection complete est relue dans la transaction Serializable I3 avant les
ecritures metier. Si le referentiel a change depuis le brouillon, la finalisation
retourne un conflit stable et toutes les ecritures sont annulees.

## N. Placement canonique

Une admission cree un `StudentTrackPlacement`, puis son `Enrollment` legacy,
puis lie les deux dans la meme transaction. Aucun troisieme modele academique
n'est introduit.

## O. Changement de classe

La classe n'est volontairement pas dans la cle unique canonique : un placement
existant peut etre modifie par une action metier explicite hors assistant.
L'operation CREATE de l'admission ne fait jamais cet update. Elle retourne
`PLACEMENT_CONFLICT`. Un E2E utilise une autre classe compatible et verifie que
la classe historique reste inchangee.

## P. RE_ENROLLMENT

La reinscription reutilise le meme `Student`, conserve les placements et
inscriptions de l'annee N, puis cree un nouveau placement et un nouveau miroir
legacy pour l'annee N+1.

## Q. Progression suggeree

Le schema ne modelise pas de relation canonique de progression entre deux
niveaux d'annees differentes. Aucune promotion automatique n'est implementee.
Une suggestion future devra rester informative et reposer sur une regle produit
explicite.

## R. Capacite de classe

`Classroom.capacity` et `actual_capacity` existent, mais aucune politique
historique ne prouve qu'une classe pleine doit bloquer l'admission. I5 retient
donc `classCapacity=INFORMATIONAL`.

L'API expose :

- `capacity` et l'ancienne metadonnee `actualCapacity` ;
- `currentEnrollmentCount`, calcule depuis les placements canoniques `ACTIVE` ;
- `placesRemaining` ;
- `capacityStatus` (`UNBOUNDED`, `AVAILABLE`, `FULL`).

Une classe pleine reste selectionnable. Il n'y a donc ni verrou de capacite ni
test de derniere place concurrente dans ce lot.

## S. Quick Create classe

L'API existante `POST /api/v1/classes` reste la seule voie de creation. Elle
requiert `reference:create` et un contexte complet (`schoolYearId`, `levelId`,
`track`, code, libelle, capacite). Aucun endpoint duplique n'est ajoute.

## T. Quick Create referentiel

La creation de cursus/cycles/niveaux reste dans le module Referentiel. Elle ne
fait pas partie du parcours novice. En l'absence de classe, le futur assistant
doit indiquer l'indisponibilite ou orienter vers un administrateur autorise.

## U. RBAC

| Operation | ADMIN | SCOLARITE | Autres roles |
| --- | --- | --- | --- |
| Lire options annees/cursus/niveaux/classes | `enrollments:read` + `reference:read` | idem | refuse |
| Sauver une selection | `enrollments:create` + `reference:read` | idem | refuse |
| Finaliser un placement | `enrollments:create` + `reference:read` | idem | refuse |
| Creer une classe | `reference:create` | selon permission effective | refuse par defaut |
| Modifier un placement existant | `enrollments:update` | selon permission effective | refuse par defaut |

Les surcharges `role_permissions` restent appliquees. Aucun droit Finance n'a
ete ajoute.

## V. Isolation tenant

Toutes les lectures de la politique filtrent `tenantId` a chaque niveau. Les
relations imbriquees recontrolent egalement le tenant. Les UUID d'un autre
tenant obtiennent les memes codes d'indisponibilite qu'une ressource absente.

## W. Erreurs stables

- `ACADEMIC_CONTEXT_INVALID` : ordre ou combinaison incomplets/incoherents ;
- `SCHOOL_YEAR_NOT_AVAILABLE` : annee non utilisable ;
- `TRACK_NOT_AVAILABLE` : cursus sans niveau actif ;
- `LEVEL_NOT_AVAILABLE` : niveau non utilisable ;
- `CLASS_NOT_AVAILABLE` : classe non utilisable ;
- `PLACEMENT_CONFLICT` : placement canonique deja present.

`CLASS_CAPACITY_REACHED` n'est pas utilise car la capacite n'est pas bloquante.
`STUDENT_ALREADY_ENROLLED` n'est pas ajoute car il dupliquerait la semantique
canonique de `PLACEMENT_CONFLICT`.

## X. Migration

Aucune migration I5. Les contraintes canoniques et les colonnes necessaires
existent deja. Les anciennes migrations n'ont pas ete modifiees.

## Y. PostgreSQL E2E

Base locale inspectee : PostgreSQL 16.14. Les contraintes reelles confirment les
deux unicites tenant/annee/eleve/cursus et les FK attendues.

Resultats executes pendant l'implementation et la validation finale :

- politique academique unitaire : PASS ;
- endpoint progressif et isolation tenant : PASS ;
- statuts annee/niveau/classe et hierarchies incompatibles : PASS ;
- capacite informative : PASS ;
- matrice Admission I1-I5 : 4 suites, 32 tests PASS.
- suite unitaire API complete : 37 suites, 220 tests PASS ;
- suite E2E PostgreSQL complete : 14 suites, 105 tests PASS ;
- integrite des suppressions rejouee separement : 1 suite, 10 tests PASS.

Le log Supabase Storage HTTP 503 observe pendant la suite E2E complete provient
du scenario volontaire de defaillance du provider et de compensation. Il ne
correspond pas a un appel cloud ni a un echec de la suite.

## Z. Non-regression I1-I4

La matrice executee couvre les prerequis, brouillons, optimistic locking,
finalisation, idempotence, rollback, matricules concurrents, guardians,
`ParentStudentLink`, `NEW_ADMISSION`, `RE_ENROLLMENT`, isolation tenant et
conflit de placement. Prisma format/validate/generate, le typecheck, le lint et
le build API sont egalement PASS. Aucune migration n'etait requise.

## Decisions restant ouvertes

1. Definir avec le produit si la capacite devient un jour bloquante. Cela
   necessitera alors une garantie PostgreSQL/concurrence dediee.
2. Modeliser explicitement la progression entre niveaux avant toute suggestion
   automatique.
3. Evaluer ulterieurement des FK composites tenant-aware ; ce changement est
   structurel et n'est pas justifie par I5 seul.
