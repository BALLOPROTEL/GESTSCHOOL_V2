# LOT I1 - Contrat fonctionnel et prérequis de l'inscription 360

Date de référence : 2026-08-22

Périmètre : contrat métier et endpoint de lecture des prérequis uniquement.

Hors périmètre : `AdmissionCase` en base, assistant frontend, finalisation, migration et modification des endpoints legacy.

## A. Prérequis

| Prérequis                                               | Niveau I1                                                              | Preuve ou limite                                                                                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Contexte tenant authentifié                             | Bloquant                                                               | Le JWT et la session active imposent un `tenantId`; aucune table `Tenant` ne modélise toutefois l'état actif d'un établissement. |
| Permission `enrollments:read` et `reference:read`       | Bloquant pour lire les prérequis                                       | Contrôlée par les guards existants.                                                                                              |
| Permission de création adaptée au mode                  | Bloquant avant finalisation                                            | Détaillée par `permissions.modes`.                                                                                               |
| Une année avec `status=ACTIVE` et `isActive=true`       | Bloquant                                                               | Une absence ou plusieurs années actives rendent la cible ambiguë.                                                                |
| Cycle et niveau actifs dans l'année active              | Bloquant                                                               | L'assistant ne doit pas proposer une hiérarchie inactive.                                                                        |
| Classe active, liée à l'année, au niveau et au parcours | Bloquant                                                               | La création automatique n'est pas permise en I1.                                                                                 |
| Plan de frais compatible                                | Warning en I1                                                          | Aucune politique financière par tenant ne dit actuellement si la finance est obligatoire.                                        |
| Responsable                                             | Autorisé absent dans un futur brouillon; décision ouverte pour `READY` | Le modèle actuel ne rend pas un responsable obligatoire pour un élève.                                                           |
| Documents                                               | Optionnel en I1                                                        | Aucun contrat de documents d'admission n'existe actuellement.                                                                    |

Le champ `tenant.eligibilitySource=AUTHENTICATED_ACTIVE_ACCOUNT` signifie uniquement que le compte et la session ont été validés par `JwtAuthGuard`. Il ne prétend pas qu'un modèle `Tenant` actif a été vérifié.

## B. Blocking issues

- `ADMISSION_ACTIVE_SCHOOL_YEAR_MISSING`
- `ADMISSION_MULTIPLE_ACTIVE_SCHOOL_YEARS`
- `ADMISSION_ACTIVE_LEVEL_MISSING`
- `ADMISSION_ACTIVE_CLASS_MISSING`
- `ADMISSION_PERMISSION_DENIED` lorsque ni `NEW_ADMISSION` ni `RE_ENROLLMENT` n'est autorisé.

## C. Warnings

- `ADMISSION_MODE_PERMISSION_LIMITED` : un seul mode est disponible.
- `ADMISSION_FEE_PLAN_NOT_AVAILABLE` : aucun plan compatible, sans conclure que la finance est obligatoire.
- `ADMISSION_FINANCE_PERMISSION_LIMITED` : les plans ne peuvent pas être lus par ce profil.
- `ADMISSION_REFERENCE_INCONSISTENCY` : une classe active a été exclue car son parcours diffère de celui de son niveau.

## D. NEW_ADMISSION

`NEW_ADMISSION` concerne la création d'un nouveau `Student`, ou la sélection d'un élève existant sans placement sur le couple année/parcours demandé. Le futur assistant doit rechercher les doublons avant de proposer une création.

Permissions minimales actuelles : `students:read`, `students:create`, `parents:read`, `parents:create`, `enrollments:create`, `reference:read`. Le futur produit devra décider si un responsable est obligatoire pour passer à `READY`.

## E. RE_ENROLLMENT

`RE_ENROLLMENT` réutilise un `Student` existant, son identité et ses liens responsables. Il crée un placement pour une nouvelle année. Il ne recrée ni élève ni responsables par défaut.

Permissions minimales actuelles : `students:read`, `parents:read`, `enrollments:create`, `reference:read`.

Règles communes :

- un placement `(tenant, schoolYear, student, track)` existant interdit une nouvelle création;
- un changement de classe ou de statut est une mise à jour explicite, jamais un effet secondaire de `CREATE`;
- un placement d'une autre année ne bloque pas une réinscription;
- les deux parcours peuvent coexister pour une même année si la structure scolaire l'autorise, conformément à l'unicité actuelle par parcours.

## F. Contrat Student

### Obligatoire pour un nouvel élève selon le contrat actuel

- prénom;
- nom;
- sexe;
- matricule fourni ou, plus tard, généré par une stratégie serveur validée.

### Facultatif dans le schéma actuel

- date et lieu de naissance;
- nationalité;
- adresse, téléphone et email;
- date d'admission;
- établissement, identifiant interne et numéro d'acte de naissance.

### Avancé

- photo;
- besoins particuliers;
- langue principale;
- notes administratives.

La date de naissance est requise par le frontend actuel mais facultative dans l'API et PostgreSQL. Rendre ce champ obligatoire et définir la génération du matricule restent deux décisions produit.

Recherche anti-doublon : correspondance exacte du matricule = conflit certain; nom/prénom normalisés + date de naissance = suspicion à confirmer; email/téléphone ou numéro d'acte = signaux complémentaires. Un nom identique ne doit jamais bloquer seul une création.

## G. Contrat Guardian

Deux sources : `EXISTING_GUARDIAN` avec `parentId`, ou `NEW_GUARDIAN`.

Pour un nouveau responsable, le contrat actuel exige rôle parental, prénom, nom et téléphone principal. Email, second téléphone, identité documentaire, adresse et profession sont facultatifs. Le lien exige un type de relation; les indicateurs principal, représentant légal, responsable financier et contact d'urgence sont explicites.

La recherche d'un responsable existant précède la création. Téléphone/email normalisés, identité documentaire et nom servent à calculer des candidats, mais aucune unicité globale ne doit être ajoutée sans preuve métier.

## H. ParentStudentLink

- un même lien actif parent/élève ne peut exister deux fois;
- un élève peut avoir plusieurs responsables;
- un parent peut avoir plusieurs enfants;
- un seul contact principal actif est protégé par un index partiel PostgreSQL;
- la relation familiale est explicite;
- les règles de suppression et d'archivage du chantier d'intégrité référentielle restent inchangées.

## I. Scolarité

La chaîne proposée est strictement : `SchoolYear -> Cycle -> Level -> Classroom` avec `AcademicTrack` porté par le niveau et la classe.

L'endpoint I1 sélectionne une année active, puis uniquement les cycles, niveaux et classes actifs du même tenant. Une classe doit appartenir à l'année active, référencer un niveau actif de cette année et partager son parcours. Le frontend futur filtrera successivement année, parcours, cycle, niveau puis classe à partir de ce payload.

La capacité est exposée à titre informatif. Le sens bloquant de `capacity/actualCapacity` reste à valider, car ces colonnes ne constituent pas actuellement une règle d'inscription fiable.

## J. Placement strict

Contrat cible pour I3/I5 :

- `CREATE` exécute une insertion et retourne `409 PLACEMENT_CONFLICT` si la portée existe;
- `CREATE` ne change jamais classe, statut, dates ou placement principal existants;
- `UPDATE` utilise une action explicite avec version ou précondition;
- `RE_ENROLLMENT` crée dans une nouvelle année;
- les endpoints legacy actuels restent inchangés en I1.

## K. Statuts

| Agrégat                 | Statuts cibles                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `Student`               | `ACTIVE`, `INACTIVE`, `SUSPENDED`, `ARCHIVED` uniquement; jamais `DRAFT` d'admission.            |
| `StudentTrackPlacement` | `ACTIVE`, `INACTIVE`, `COMPLETED`, `SUSPENDED`.                                                  |
| `Enrollment` legacy     | Valeur dérivée temporairement du placement; aucune chaîne libre fournie par le nouvel assistant. |
| futur `AdmissionCase`   | `DRAFT`, `READY`, `FINALIZING`, `CONFIRMED`, `FAILED`, `CANCELLED`.                              |

Les valeurs frontend `DRAFT/PENDING` actuellement proposées pour `Student.status` sont incompatibles avec le DTO API et devront être retirées dans un lot frontend, pas contournées.

## L. Finance

Le contrat futur distingue :

- `IMMEDIATE` : sélection d'un `FeePlan` existant compatible, puis facture lors de la finalisation si la politique le confirme;
- `DEFERRED` : admission confirmée avec un suivi financier explicite en attente;
- `EXEMPT_OR_SPECIAL` : motif et autorisation à définir, sans créer un faux plan à montant nul.

Un plan est filtré par année et niveau du placement principal. Le modèle actuel ne porte ni échéancier, ni options/services, ni politique obligatoire par tenant. I1 expose donc `financePolicy=UNCONFIGURED` et ne crée aucune facture.

## M. Quick Create

| Ressource        | Décision                                                          | Permission actuelle minimale                    |
| ---------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| Élève            | Recommandé dans `NEW_ADMISSION`, après recherche anti-doublon     | `students:create`                               |
| Responsable      | Recommandé, après recherche/réutilisation                         | `parents:create`                                |
| Lien responsable | Recommandé dans la même orchestration                             | `parents:create`                                |
| Classe           | Autorisé uniquement avec contexte année/niveau/parcours prérempli | `reference:create`                              |
| Cycle/Niveau     | Hors workflow standard; utiliser le référentiel                   | `reference:create`                              |
| FeePlan          | Hors workflow novice; rôle financier/administratif                | `finance:create` et rôle `ADMIN` ou `COMPTABLE` |

## N. RBAC

| Action                 | Permission actuelle      | Rôles de route actuels      | Cible assistant                            | Bloquant                     |
| ---------------------- | ------------------------ | --------------------------- | ------------------------------------------ | ---------------------------- |
| Lire élèves            | `students:read`          | ADMIN, SCOLARITE            | Recherche anti-doublon                     | Oui                          |
| Créer élève            | `students:create`        | ADMIN, SCOLARITE            | `NEW_ADMISSION`                            | Oui pour ce mode             |
| Lire/créer responsable | `parents:read/create`    | ADMIN, SCOLARITE            | Recherche et création                      | Oui pour nouveau responsable |
| Créer lien             | `parents:create`         | ADMIN, SCOLARITE            | Orchestration                              | Selon règle responsable      |
| Lire référentiel       | `reference:read`         | ADMIN, SCOLARITE            | Tous modes                                 | Oui                          |
| Créer classe           | `reference:create`       | ADMIN, SCOLARITE            | Quick Create contrôlé                      | Non si classe disponible     |
| Créer placement        | `enrollments:create`     | ADMIN, SCOLARITE            | Tous modes                                 | Oui                          |
| Modifier placement     | `enrollments:update`     | ADMIN, SCOLARITE            | Action distincte                           | Non pour création            |
| Lire plans             | `finance:read`           | ADMIN, SCOLARITE, COMPTABLE | Disposition financière                     | Selon politique              |
| Créer plan/facture     | `finance:create`         | ADMIN, COMPTABLE            | Handoff financier                          | Selon politique              |
| Finaliser admission    | Aucune permission dédiée | N/A                         | Permission dédiée ou composition à décider | Décision ouverte             |

Le conflit SCOLARITE/Finance est conservé : `SCOLARITE` lit les plans mais ne crée ni plan ni facture. I1 ne lui élargit aucun droit.

## O. Contrats d'erreurs futurs

Codes stables à traduire côté frontend :

- `ADMISSION_PREREQUISITES_MISSING`
- `ADMISSION_MODE_INVALID`
- `ADMISSION_STATE_CONFLICT`
- `ADMISSION_VERSION_CONFLICT`
- `ADMISSION_IDEMPOTENCY_CONFLICT`
- `STUDENT_DUPLICATE_SUSPECTED`
- `STUDENT_ALREADY_ENROLLED`
- `GUARDIAN_DUPLICATE_SUSPECTED`
- `GUARDIAN_LINK_CONFLICT`
- `PLACEMENT_CONFLICT`
- `CLASS_NOT_AVAILABLE`
- `FEE_PLAN_NOT_AVAILABLE`
- `ADMISSION_PERMISSION_DENIED`

Une suspicion retourne des candidats techniques minimaux et demande confirmation; elle ne fusionne ni ne bloque automatiquement deux personnes. Les messages humains FR/EN/AR restent côté frontend.

## P. Idempotence

La future finalisation reçoit une clé opaque générée côté client et liée à `(tenantId, admissionCaseId, operation=FINALIZE)`. PostgreSQL doit imposer son unicité. Un rejeu avec le même payload retourne le résultat déjà confirmé; la même clé avec un payload différent retourne `409 ADMISSION_IDEMPOTENCY_CONFLICT`.

La contrainte de placement reste la protection finale contre deux clics concurrents. Facture, liens et outbox nécessitent leurs propres invariants métier dans les lots correspondants.

## Q. Contrat fonctionnel du futur AdmissionCase

Transitions autorisées :

- `DRAFT -> READY | CANCELLED`
- `READY -> DRAFT | FINALIZING | CANCELLED`
- `FINALIZING -> CONFIRMED | FAILED`
- `FAILED -> DRAFT | READY | FINALIZING | CANCELLED` selon la cause enregistrée
- `CONFIRMED` terminal;
- `CANCELLED` terminal, sauf décision produit explicite future.

Un `DRAFT` exige seulement tenant, auteur et mode. `READY` exige une identité élève résolue, une combinaison scolaire valide, les permissions et toutes les sections déclarées obligatoires par la politique produit. `FINALIZING` verrouille les modifications. Une version entière croissante protège les mises à jour optimistes.

Le futur payload fonctionnel contient : mode, source élève existant/nouveau, responsables existants/nouveaux et liens, scolarité, disposition financière, références documentaires temporaires, version et clé d'idempotence. Aucun secret fournisseur n'y figure.

## R. Finalisation future

`POST /admission-cases/:id/finalize` devra, dans une transaction PostgreSQL unique :

1. verrouiller et vérifier l'état/version du dossier;
2. créer ou relire le `Student` sans doublon;
3. créer les nouveaux `Parent` et `ParentStudentLink` nécessaires;
4. créer strictement `StudentTrackPlacement`;
5. synchroniser `Enrollment` tant que le miroir legacy existe;
6. enregistrer la disposition financière et éventuellement l'`Invoice` selon politique;
7. écrire `AuditLog` et `OutboxEvent`;
8. passer le dossier à `CONFIRMED`.

Emails, SMS, appels fournisseurs, génération lourde et uploads définitifs restent hors transaction et sont déclenchés par outbox ou compensation.

## S. Compatibilité legacy

`StudentTrackPlacement` reste la source canonique. `Enrollment` est encore lu ou exposé par :

- `GET /enrollments` et ses vues frontend Dashboard/Inscriptions/Pilotage;
- le portail parent et le portail enseignant via `legacyEnrollmentId`;
- les tests `source-of-truth.e2e-spec.ts`;
- la synchronisation `AcademicStructureService`.

I1 ne supprime rien. Trajectoire proposée : création stricte dans le futur orchestrateur avec miroir transactionnel, migration des lecteurs vers placement, mesure des dépendances restantes, puis dépréciation séparée de `Enrollment`.

## T. Décisions restant à valider

1. Introduire ou non un modèle de tenant/établissement avec état actif.
2. Rendre la date de naissance obligatoire avant `READY`.
3. Définir la stratégie serveur de génération du matricule.
4. Exiger ou non au moins un responsable avant finalisation.
5. Modéliser la politique finance `IMMEDIATE/DEFERRED/EXEMPT_OR_SPECIAL` par tenant.
6. Définir échéanciers, remises, exemptions et services.
7. Définir la politique de capacité des classes.
8. Définir les documents obligatoires par type d'admission.
9. Créer une permission dédiée de finalisation ou conserver une composition de permissions.
10. Définir rétention, réouverture et purge des brouillons annulés.

## Endpoint I1

`GET /api/v1/admission-prerequisites`

- lecture seule;
- rôles `ADMIN` et `SCOLARITE`;
- permissions d'accès `enrollments:read` et `reference:read`;
- tenant issu de la session, non surchargeable;
- contrat versionné `1`;
- aucune donnée personnelle;
- aucune classe, niveau, cycle ou année inactive;
- aucun plan retourné si `finance:read` est refusé.

Structure stable :

```json
{
  "contractVersion": "1",
  "tenant": {
    "id": "<tenant-uuid>",
    "eligibilitySource": "AUTHENTICATED_ACTIVE_ACCOUNT"
  },
  "supportedModes": ["NEW_ADMISSION", "RE_ENROLLMENT"],
  "schoolYear": null,
  "tracks": [],
  "levels": [],
  "classes": [],
  "feePlans": [],
  "financePolicy": "UNCONFIGURED",
  "permissions": {
    "canReadStudents": true,
    "canCreateStudent": true,
    "canReadGuardians": true,
    "canCreateGuardianAndLink": true,
    "canCreatePlacement": true,
    "canUpdatePlacement": true,
    "canReadReference": true,
    "canQuickCreateClass": true,
    "canReadFeePlans": true,
    "canCreateFeePlan": false,
    "canCreateInvoice": false,
    "modes": {
      "NEW_ADMISSION": { "allowed": true, "missingPermissions": [] },
      "RE_ENROLLMENT": { "allowed": true, "missingPermissions": [] }
    }
  },
  "blockingIssues": [
    {
      "code": "ADMISSION_ACTIVE_SCHOOL_YEAR_MISSING",
      "scope": "ACADEMIC"
    }
  ],
  "warnings": [],
  "ready": false
}
```

Les tableaux réels contiennent uniquement les identifiants et libellés nécessaires aux sélections dépendantes.
