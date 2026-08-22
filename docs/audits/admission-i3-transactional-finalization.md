# LOT I3 - Finalisation transactionnelle des admissions

Date de validation locale : 2026-08-22

## Verdict

**GO I3 local**. La confirmation d'un `AdmissionCase` READY produit les donnees
metier dans une seule transaction PostgreSQL et persiste un resultat idempotent.
Aucune base distante, aucun fournisseur externe et aucune donnee de production
n'ont ete utilises.

Ce verdict n'autorise ni commit, ni push, ni migration ou deploiement distant.

## Diagnostic initial des services

| Domaine | Etat avant I3 | Decision I3 |
| --- | --- | --- |
| Student | Mapping, validation des dates et contrainte matricule deja portes par `StudentsService` | Mapping partage et nouvelle operation `createForAdmission` acceptant un `TransactionClient`; controle certain et suspect rejoue dans la transaction |
| Parent | `createParent` ouvrait sa propre transaction et ajoutait son propre audit | Mapping partage; operations transaction-aware sans sous-transaction ni audit technique redondant |
| ParentStudentLink | Creation HTTP transactionnelle mais non reutilisable dans une transaction externe | Operation transaction-aware verifiant tenant, disponibilite, lien actif existant et responsable principal |
| StudentTrackPlacement | Methode historique `upsert` susceptible de modifier silencieusement un placement existant | Operation CREATE stricte distincte; un placement existant retourne `PLACEMENT_CONFLICT` |
| Enrollment legacy | Cree ou modifie par l'upsert historique | Creation explicite dans la meme transaction que le placement; liaison `legacyEnrollmentId` immediate |
| AuditLog | `AuditService.recordLog` accepte deja un client transactionnel | Un seul audit metier `ADMISSION_CONFIRMED`, avec IDs techniques uniquement |
| Outbox | `OutboxService.publish` accepte deja un client transactionnel et une cle de deduplication | Evenement durable `admission.confirmed` dans la transaction, sans livraison externe |
| Matricule | Saisi par l'utilisateur et protege par `(tenant_id, matricule)` | Politique manuelle conservee; aucun generateur `COUNT + 1` invente |
| Finance | Contrat I1 `UNCONFIGURED` | Aucune facture ni plan de frais cree; `invoiceIds` reste vide |
| Storage/Documents | Section differee par I2 | Aucun upload, deplacement ou appel Supabase dans I3 |

## Architecture appliquee

`POST /api/v1/admission-cases/:id/finalize` appelle
`AdmissionFinalizationService` avec :

- le tenant issu du token et du contexte serveur, jamais du payload ;
- `expectedVersion` ;
- une `idempotencyKey` obligatoire de 8 a 200 caracteres ;
- les permissions `enrollments:create` et `reference:read`, puis les droits de
  mode I1 (`NEW_ADMISSION` ou `RE_ENROLLMENT`).

L'orchestrateur contient la sequence, mais delegue les regles de domaine aux
services Students, Parents et Academic Structure.

## Frontiere transactionnelle

La finalisation utilise deux transactions courtes et controlees :

1. **Reservation serializable** : verrou logique par `version`, passage
   READY/FAILED/lease expiree vers FINALIZING, hash canonique et lease de deux
   minutes.
2. **Transaction metier serializable unique** : Student eventuel, Parent(s),
   liens, Placement canonique, Enrollment miroir, AuditLog, Outbox, resultat
   stable et passage CONFIRMED.

Le premier passage FINALIZING est volontairement persiste hors transaction
metier. Si le processus tombe avant la transaction metier, le lease expire et
la meme operation peut reprendre. Si le processus tombe apres le commit, le
dossier est deja CONFIRMED et le retry retourne le resultat persiste.

En echec controle, la transaction metier rollback integralement, puis le
dossier passe a FAILED avec :

- un code stable limite a 80 caracteres ;
- un message generique sans stack trace, secret ni donnee personnelle ;
- aucune ecriture metier partielle ;
- la meme cle et le meme hash pour autoriser un retry controle avec la version
  courante.

## NEW_ADMISSION

- le Student n'existe pas avant finalize ;
- les champs minimaux et les dates sont revalides par `StudentsService` ;
- `(tenant, matricule)` est recontrole et protege par PostgreSQL ;
- nom + prenom + date de naissance produit
  `STUDENT_DUPLICATE_SUSPECTED`, sans fusion automatique ;
- un responsable NEW est controle sur une correspondance exacte
  nom/prenom/telephone ou piece d'identite et produit
  `GUARDIAN_DUPLICATE_SUSPECTED` ;
- un responsable EXISTING doit etre actif, non archive et dans le meme tenant ;
- le Student, les responsables et leurs liens sont crees uniquement dans la
  transaction finale.

## RE_ENROLLMENT

- `AdmissionCase.studentId` est obligatoire et revalide dans le tenant ;
- aucun Student n'est cree ou modifie ;
- les historiques precedents restent inchanges ;
- seuls le nouveau Placement et son Enrollment miroir sont crees pour l'annee
  cible ;
- un placement canonique deja present produit `PLACEMENT_CONFLICT`.

## Scolarite et placement strict

Au moment du finalize, I3 recharge et controle :

- annee active et unique du tenant ;
- cycle actif rattache a cette annee ;
- niveau actif et parcours coherent ;
- classe active, meme annee, niveau, cycle, parcours et tenant ;
- Student actif et disponible ;
- absence de placement `(tenant, schoolYear, student, track)`.

La methode historique `upsertTrackPlacement` n'est jamais utilisee par I3.
Le Placement canonique et l'Enrollment legacy sont crees explicitement. Une
erreur Enrollment rollback le Placement et toutes les creations precedentes.

## Idempotence et concurrence

Le hash SHA-256 est calcule sur une serialisation JSON canonique de :

- mode ;
- version du contrat de brouillon ;
- Student existant eventuel ;
- toutes les sections du brouillon.

Comportements verifies :

- meme dossier + meme cle + meme payload : resultat CONFIRMED strictement
  identique, sans nouvelle ecriture ;
- meme cle avec payload logique altere : HTTP 409
  `ADMISSION_IDEMPOTENCY_CONFLICT` ;
- autre cle apres confirmation : HTTP 409
  `ADMISSION_IDEMPOTENCY_CONFLICT` ;
- deux appels concurrents : un seul ensemble Student/Parent/Link/Placement/
  Enrollment/Audit/Outbox ; le second retourne le resultat ou un 409 stable ;
- aucune protection en memoire Node.js : version, isolation serializable,
  contrainte unique et lease PostgreSQL sont les protections finales.

## Etats AdmissionCase

Transitions actives :

```text
READY -> FINALIZING -> CONFIRMED
                    -> FAILED
FAILED --retry meme cle/hash--> FINALIZING
FINALIZING lease expire --retry meme cle/hash--> FINALIZING
```

Un dossier CONFIRMED reste lisible, expose son resultat et n'accepte plus de
PATCH ou d'annulation. Un dossier CANCELLED ou DRAFT ne peut pas etre finalise.

## Resultat persiste

Le contrat de resultat version `1` contient :

- `admissionCaseId` ;
- `studentId` ;
- `placementId` ;
- `enrollmentId` ;
- `guardianIds` ;
- `parentStudentLinkIds` ;
- `invoiceIds` (vide en I3) ;
- `confirmedAt` ;
- `version`.

## Audit et Outbox

La transaction cree exactement :

- un `IamAuditLog` `ADMISSION_CONFIRMED` sans copie des donnees personnelles ;
- un `OutboxEvent` `admission.confirmed` avec la cle
  `admission-confirmed:<caseId>`.

I3 ne demarre aucun worker et n'envoie aucun email, SMS ou webhook.

## Migration PostgreSQL

Migration ajoutee :

`20260822220000_admission_transactional_finalization`

Elle est transactionnelle et ne modifie que `admission_cases`. Elle ajoute :

- resultat JSON ;
- timestamps de tentative, confirmation et echec ;
- token et expiration de lease ;
- diagnostic sanitise ;
- contraintes de coherence FINALIZING/CONFIRMED/FAILED ;
- index de recuperation des leases.

### PostgreSQL 17 from scratch

- 38 migrations detectees ;
- 38 migrations appliquees ;
- migration I3 appliquee dans l'ordre ;
- `prisma migrate status` a jour ;
- E2E complet execute sur cette base jetable.

### PostgreSQL 17 preexistant I2

- 37 migrations appliquees dans une copie locale temporaire sans I3 ;
- un dossier DRAFT et un dossier READY techniques inseres ;
- migration I3 appliquee seule ensuite ;
- 2 dossiers conserves : 1 DRAFT, 1 READY ;
- 8 nouvelles colonnes presentes et nulles sur les lignes historiques ;
- schema a jour a 38 migrations.

## Matrice rollback

Une panne test-only a ete injectee :

1. apres Student ;
2. apres Guardian ;
3. apres ParentStudentLink ;
4. apres Placement ;
5. apres Enrollment ;
6. avant AuditLog/Outbox ;
7. avant commit final.

Pour les sept points :

- Student, Parent, Link, Placement, Enrollment, Invoice, Audit et Outbox ont
  conserve exactement leurs compteurs initiaux ;
- le dossier est FAILED, sans lease actif ni message de panne interne ;
- aucune FK orpheline n'a ete creee ;
- le retry apres l'echec avant commit a confirme le dossier avec succes.

Les injections utilisent uniquement un espion Jest sur une methode privee
sans variable, endpoint ou hook de panne activable en production.

## Validations executees

- Prisma format : execute, bruit historique retire du diff ;
- Prisma validate : PASS ;
- Prisma generate 6.19.3 : PASS ;
- API typecheck : PASS ;
- API lint : PASS ;
- API build : PASS ;
- tests unitaires cibles I1/I2/I3 : PASS ;
- tests unitaires complets : **35 suites, 212 tests, 0 echec** ;
- E2E I3 : **13 tests, 0 echec** ;
- E2E PostgreSQL complets : **12 suites, 93 tests, 0 echec** ;
- tests deletion integrity et domaines legacy inclus dans l'E2E complet : PASS ;
- `git diff --check` : PASS.

Le log Supabase 503 observe pendant l'E2E complet correspond au scenario
volontaire de compensation du test storage existant. Aucun appel cloud reel
n'a ete effectue.

## Decisions conservees pour I4-I6

- obligation produit d'au moins un responsable : non decidee, comportement I2
  conserve ;
- generation automatique du matricule : non inventee, saisie manuelle gardee ;
- politique de frais/facturation : `UNCONFIGURED`, aucune facture I3 ;
- documents : association et workflow differes ;
- UX de reprise d'un dossier FAILED et exposition des codes i18n : lot frontend
  ulterieur ;
- eventuels traitements asynchrones apres `admission.confirmed` : lots suivants,
  fournisseurs toujours desactives ici.

## Compatibilite legacy

Les endpoints Students, Parents et Academic Structure existants conservent
leurs contrats. Les nouvelles operations sont additives et transaction-aware.
Le frontend n'est pas modifie. La seule difference volontaire est que la
finalisation d'admission utilise un CREATE strict au lieu de l'upsert de
placement historique.
