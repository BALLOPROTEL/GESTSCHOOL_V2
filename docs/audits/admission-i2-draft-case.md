# LOT I2 - AdmissionCase, brouillon persistant et reprise

Date de référence : 2026-08-22

Périmètre : dossier de brouillon uniquement. Aucun élève, responsable, lien familial, placement, inscription legacy, facture, paiement, fichier, notification ou événement outbox n'est créé par les routes I2.

## A. Modèle AdmissionCase

`AdmissionCase` est un agrégat tenanté indépendant, identifié par UUID et stocké dans `admission_cases`.

| Champ | Rôle |
| --- | --- |
| `id`, `tenantId` | Identité technique et isolation établissement. Il n'existe pas de table `Tenant` à référencer. |
| `mode` | `NEW_ADMISSION` ou `RE_ENROLLMENT`. |
| `status` | État persistant du workflow. |
| `version` | Verrou optimiste entier, initialisé à 1. |
| `payloadVersion` | Version du contrat JSONB, figée à 1 par contrainte SQL. |
| `draftData` | Sections partielles validées, objet JSONB uniquement. |
| `studentId` | Élève existant pour une réinscription, nullable et `ON DELETE SET NULL`. |
| `schoolYearId` | Année choisie dans la section scolaire, nullable et `ON DELETE SET NULL`. |
| `createdByUserId`, `updatedByUserId` | Auteurs techniques, nullables pour ne pas bloquer la suppression d'un compte. |
| `finalizationIdempotencyKey`, `finalizationPayloadHash` | Réservation nullable pour I3, jamais acceptée par l'API I2. |
| `cancelledAt`, `createdAt`, `updatedAt` | Cycle de vie et traçabilité. |

Des contraintes SQL imposent `version >= 1`, `payload_version = 1`, un JSONB objet et la présence conjointe de la future clé d'idempotence et de son hash.

## B. Stockage des sections

Le choix retenu est un JSONB versionné. Des tables détaillées créeraient prématurément des entités métier; des colonnes par champ rendraient les sections partielles rigides. Le JSONB permet une reprise progressive tout en restant strict :

- aucun `any` dans le contrat API;
- DTO dédié pour chaque section;
- whitelist et rejet des champs inconnus;
- revalidation lors de la lecture du JSON stocké;
- seules `STUDENT`, `GUARDIANS`, `ACADEMICS` et `FINANCE` sont modifiables;
- `DOCUMENTS` reste explicitement `null` en I2, faute de contrat de document d'admission;
- aucun binaire, URL de fichier ou secret fournisseur n'est stocké.

Le payload version 1 a la forme suivante :

```json
{
  "STUDENT": {},
  "GUARDIANS": { "guardians": [] },
  "ACADEMICS": {},
  "FINANCE": {}
}
```

Une future évolution destructive du payload exigera un nouveau `payloadVersion` et une migration explicite; I3 ne doit pas réinterpréter silencieusement une version inconnue.

## C. Modes

- `NEW_ADMISSION` interdit `studentId`; l'identité future reste dans `STUDENT`.
- `RE_ENROLLMENT` exige un élève existant, non supprimé et non archivé du tenant authentifié. Sa fiche n'est ni copiée ni modifiée.

Les permissions effectives du mode proviennent exclusivement de `AdmissionPrerequisitesService` I1.

## D. États

L'enum contient dès I2 : `DRAFT`, `READY`, `FINALIZING`, `CONFIRMED`, `FAILED`, `CANCELLED`.

I2 ne permet fonctionnellement que :

- `DRAFT -> READY` après calcul backend;
- `READY -> DRAFT` si une sauvegarde rend le dossier incomplet;
- `DRAFT -> CANCELLED`;
- `READY -> CANCELLED`.

`FINALIZING`, `CONFIRMED` et `FAILED` sont réservés à I3 et aucune route I2 n'accepte un statut client.

## E. Transitions

La sauvegarde et l'annulation passent par une unique politique dans `AdmissionCasesService`. Un dossier `CANCELLED` est terminal et retourne `ADMISSION_CASE_CANCELLED`. Tout état I3 rencontré en I2 retourne `ADMISSION_INVALID_TRANSITION`.

L'annulation est logique : le dossier reste lisible, reçoit `cancelledAt`, incrémente sa version et ne supprime aucune ligne.

## F. Verrou optimiste

Chaque mutation exige `expectedVersion`. Le `PATCH` est une instruction `UPDATE ... WHERE id + tenant_id + version + status`, avec incrément atomique de la version. Le calcul du prochain payload peut lire la version courante, mais une écriture concurrente ne peut pas être écrasée : si `updateMany` ne modifie aucune ligne, l'API retourne HTTP 409 avec `ADMISSION_VERSION_CONFLICT`.

Deux PATCH parallèles portant la même version produisent exactement un succès et un conflit; aucune fusion silencieuse n'est effectuée.

## G. Idempotence future

I2 réserve un couple nullable :

- `finalization_idempotency_key` opaque, limitée à 200 caractères;
- `finalization_payload_hash` SHA-256 en hexadécimal.

Une unicité PostgreSQL `(tenant_id, finalization_idempotency_key)` empêche les collisions dans un tenant sans collision cross-tenant. I2 ne lit ni n'écrit ces colonnes.

I3 devra appliquer : même clé + même hash = résultat déjà confirmé; même clé + hash différent = HTTP 409 `ADMISSION_IDEMPOTENCY_CONFLICT`.

## H. FK et onDelete

| Relation | Décision | Justification |
| --- | --- | --- |
| tenant | Pas de FK | Le schéma actuel ne contient aucun modèle `Tenant`; l'isolation est imposée dans toutes les requêtes. |
| `student_id` | `SET NULL` | Un brouillon historique ne doit pas empêcher une suppression élève autorisée. La réinscription redevient non prête. |
| `school_year_id` | `SET NULL` | Une configuration supprimée ne doit pas être bloquée par un brouillon. Le JSON conservé devient invalide face aux prérequis actifs. |
| `created_by_user_id` | `SET NULL` | Conservation du dossier sans bloquer la suppression d'un compte. |
| `updated_by_user_id` | `SET NULL` | Même politique que l'auteur initial. |

Aucune relation I2 n'utilise `CASCADE`, `RESTRICT` ou `NO ACTION`. Les contrôles cross-tenant sont applicatifs à l'écriture; PostgreSQL protège l'existence des identifiants tant qu'ils sont référencés.

## I. Endpoints

| Méthode | Route | Usage |
| --- | --- | --- |
| `POST` | `/api/v1/admission-cases` | Créer un brouillon minimal. |
| `GET` | `/api/v1/admission-cases` | Lister par mise à jour récente, avec page, limite, mode et statut optionnels. |
| `GET` | `/api/v1/admission-cases/:id` | Reprendre un dossier et son état dérivé. |
| `PATCH` | `/api/v1/admission-cases/:id/sections/:section` | Remplacer atomiquement une section validée avec `expectedVersion`. |
| `POST` | `/api/v1/admission-cases/:id/cancel` | Annuler avec `expectedVersion`, sans suppression physique. |

Le DTO de réponse est versionné et expose métadonnées, sections, complétude, blocages, warnings et horodatages. Aucun `tenantId` client n'est accepté.

## J. RBAC et isolation tenant

- rôles : `ADMIN`, `SCOLARITE`;
- lecture : `enrollments:read` + `reference:read`;
- création/modification/annulation : `enrollments:create` + `reference:read`;
- le service I1 vérifie en plus la composition complète des permissions du mode;
- chaque lecture et mutation inclut `tenantId` issu du compte authentifié;
- un UUID d'un autre tenant est indistinguable d'un dossier absent (`ADMISSION_CASE_NOT_FOUND`).

## K. Readiness

La readiness est calculée par le backend et ne peut pas être envoyée par le client. Elle réutilise le payload I1 et exige uniquement les règles déjà validées :

- prérequis I1 sans blocage;
- mode autorisé;
- `NEW_ADMISSION` : matricule, prénom, nom et sexe présents dans le brouillon;
- `RE_ENROLLMENT` : élève existant toujours sélectionnable;
- année, cycle, niveau, classe et parcours actifs et cohérents.

Responsables, finance et documents ne bloquent pas `READY`, car leur caractère obligatoire reste ouvert en I1. `financePolicy=UNCONFIGURED` ne transforme donc pas l'absence de `FeePlan` en blocage.

## L. NEW_ADMISSION

Les données élève restent dans le JSONB. Une sauvegarde ne crée ni ne met à jour `Student`. La détection de doublon, la génération du matricule et la création transactionnelle restent à I3.

## M. RE_ENROLLMENT

Le dossier référence un `Student` actif du même tenant. Les responsables existants ne sont pas copiés. Aucun placement ou miroir `Enrollment` n'est créé avant finalisation.

## N. Annulation et audit

Deux événements seulement sont enregistrés directement dans `iam_audit_logs` :

- `ADMISSION_CASE_CREATED` avec le mode;
- `ADMISSION_CASE_CANCELLED` avec l'état précédent.

Les frappes et sauvegardes de sections ne créent aucun audit bruyant. I2 ne publie aucun événement outbox et ne déclenche aucune notification.

## O. Migration

Migration unique : `20260822130000_admission_case_drafts`.

Elle est transactionnelle et crée uniquement :

- les deux enums;
- `admission_cases`;
- quatre FK `SET NULL`;
- les contraintes de version/JSON/idempotence;
- les index tenant/statut/date, élève et année.

Aucune ancienne migration ni table métier n'est modifiée.

## P. Tests PostgreSQL et concurrence

Couverture ajoutée :

- migration SQL transactionnelle et non destructive;
- création des deux modes;
- étudiant obligatoire et tenanté en réinscription;
- reprise multi-section;
- validation stricte et rejet d'une injection de statut;
- transition automatique `DRAFT/READY`;
- conflit de version stable;
- deux PATCH concurrents;
- annulation terminale;
- isolation inter-tenant;
- comptage physique avant/après des tables métier.

Les résultats réellement exécutés sont consignés dans la section `Validations finales` à la fin de cette passe.

## Q. Compatibilité legacy

Les routes et services `Students`, `Parents`, `Enrollments`, `Finance`, Dashboard et portails ne changent pas. `StudentTrackPlacement` reste canonique et `Enrollment` reste le miroir legacy. I2 n'appelle aucun de leurs services de création.

## R. Limites et décisions I3

1. Définir génération et réservation du matricule.
2. Décider si date de naissance et responsable sont obligatoires.
3. Modéliser la politique financière du tenant.
4. Définir les documents d'admission et leur stockage temporaire privé.
5. Implémenter le hash canonique et le protocole d'idempotence de finalisation.
6. Verrouiller et finaliser dans une transaction PostgreSQL unique.
7. Créer strictement élève, responsables, liens, placement, miroir legacy et éventuelle facture.
8. Définir la reprise depuis `FAILED` et la rétention des dossiers annulés.

## Validations finales

Validations exécutées le 2026-08-22 :

| Contrôle | Résultat |
| --- | --- |
| Prisma validate | PASS, schéma valide. |
| Prisma generate | PASS, client Prisma 6.19.3 généré. |
| PostgreSQL 16 vierge | PASS, 37 migrations sur 37 appliquées. |
| PostgreSQL 16 préexistant | PASS, 36 migrations puis I2 seule; 1 utilisateur technique, 1 année et 1 élève conservés, 0 brouillon introduit. |
| Schéma physique I2 | PASS, 16 colonnes, 9 contraintes dont 4 FK `ON DELETE SET NULL`, 5 index et les 2 enums attendus. |
| Prisma migrate status | PASS, base jetable à jour avec 37 migrations. |
| Typecheck API | PASS. |
| Lint API | PASS. |
| Build API | PASS. |
| Tests unitaires ciblés I1/I2 | PASS, 3 suites et 18 tests. |
| Tests unitaires API complets | PASS, 33 suites et 205 tests. |
| E2E AdmissionCase ciblés | PASS, 1 suite et 7 tests. |
| E2E PostgreSQL complets | PASS, 11 suites et 80 tests. |

Les E2E ciblés comparent les nombres physiques des tables `students`, `parents`, `parent_student_links`, `student_track_placements`, `enrollments`, `invoices`, `payments`, `notifications` et `outbox_events` avant et après le parcours I2 : aucune ligne métier n'est créée. Les deux sauvegardes concurrentes sur la même version donnent un succès et un HTTP 409, puis une seule version persistée.

Le log Supabase 503 apparu pendant la suite E2E complète correspond au scénario volontaire de compensation d'un échec de stockage; la suite concernée est PASS. Aucun fournisseur externe réel n'a été appelé.
