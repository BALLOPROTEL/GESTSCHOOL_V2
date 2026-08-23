# LOT I6 - Finance d'admission, plan de frais et facturation sure

Date de validation locale : 2026-08-23

Perimetre : backend NestJS/Prisma et PostgreSQL 16 local jetable. Aucun
frontend, aucun provider de paiement, aucun email/SMS, aucune migration et
aucune operation de production.

## A. Modele Finance actuel

La chaine metier reellement modelisee est :

`FeePlan -> Invoice -> Payment -> PaymentProviderAttempt`.

Il n'existe pas de `InvoiceItem`, de table d'affectation d'un plan a un eleve,
d'echeancier, de catalogue de services, de remise, de bourse ou d'exoneration.
Le parcours d'admission peut donc selectionner un plan existant comme intention,
mais il ne peut pas inventer ces concepts ni detourner une facture pour les
representer.

## B. FeePlan / bareme

`FeePlan` appartient a un tenant, une annee scolaire et un niveau. Il porte un
libelle, `totalAmount` et `currency`. L'unicite PostgreSQL est :

`(tenant_id, school_year_id, level_id, label)`.

Il ne porte pas de statut actif/archive ni de classe/cursus explicite. La
compatibilite I6 est donc volontairement limitee aux attributs reels : tenant,
annee scolaire et niveau. I6 reutilise toujours un plan existant et ne cree
jamais de `FeePlan` par eleve.

## C. Affectation d'un plan

Aucune entite d'affectation n'existe. I6 n'en ajoute pas, car les regles
d'activation, d'override, de facturation automatique et d'historisation ne sont
pas encore definies. L'intention reste dans la section `FINANCE` du brouillon,
puis dans le resultat de finalisation, l'audit et l'evenement durable.

Une future affectation ne devra etre introduite qu'avec sa propre source de
verite, sa cle d'idempotence et ses regles de modification.

## D. Invoice

`Invoice` relie un eleve, une annee, un plan optionnel et des placements
optionnels. `amountDue` est stocke dans la facture : une facture existante ne
depend donc pas dynamiquement du montant courant du `FeePlan`. `amountPaid` vaut
zero par defaut.

Le modele ne relie pas une facture a `AdmissionCase` et ne possede pas de cle
d'idempotence d'admission. I6 ne cree donc pas de facture automatiquement.

## E. Payment

`Payment` est une operation distincte rattachee a une facture. Les tentatives
fournisseur sont dans `PaymentProviderAttempt`. Aucun `Payment`, aucune
tentative fournisseur, aucun webhook et aucun appel reseau n'est declenche par
I6.

## F. Politique Finance retenue

La politique d'admission est explicitement `OPTIONAL`. Une admission peut etre
confirmee sans disposition financiere. Ce choix remplace l'ancien etat
`UNCONFIGURED` par un contrat utilisable sans introduire une configuration
tenant non prouvee.

`REQUIRED` n'est pas active : aucune configuration d'etablissement ne permet de
le definir de facon sure. `DEFERRED` est un mode d'intention disponible sous la
politique `OPTIONAL`, pas une seconde politique tenant.

## G. Modes financiers

Modes stables acceptes par le DTO :

- `FEE_PLAN` : selection d'un plan existant compatible ;
- `DEFERRED` : traitement financier ulterieur.

`UNSPECIFIED` existe uniquement dans le resultat normalise d'une finalisation
sans section Finance. Il n'est pas une valeur acceptee par le DTO.

`EXEMPT` n'est pas propose, car aucune exemption robuste n'existe dans le
modele. Les anciens brouillons sont lus de maniere compatible : `IMMEDIATE`
devient `FEE_PLAN`, `DEFERRED` et `EXEMPT_OR_SPECIAL` deviennent `DEFERRED`.
Aucune reecriture de donnees historiques n'est effectuee.

## H. Options Finance API

Endpoint ajoute :

`GET /api/v1/admission-cases/finance-options?admissionCaseId=<uuid>`

Il retourne : version du contrat, politique, modes, contexte academique, plans
compatibles, intention courante, capacites RBAC, warnings et erreurs bloquantes.
Les echeanciers, services, remises et exemptions sont explicitement marques
`supported: false`.

Les plans sont filtres cote serveur par tenant, annee et niveau. L'endpoint ne
retourne pas toutes les ecritures comptables et ne revele pas un plan d'un autre
tenant.

## I. AdmissionCase FINANCE

Structure stabilisee :

```json
{
  "mode": "FEE_PLAN",
  "feePlanId": "uuid",
  "note": "texte optionnel limite a 500 caracteres"
}
```

ou :

```json
{
  "mode": "DEFERRED"
}
```

Le DTO refuse les champs inconnus, valide les UUID et interdit un `feePlanId`
sans `FEE_PLAN` ainsi qu'un plan en mode `DEFERRED`. Aucun identifiant ou secret
de paiement n'est stocke.

## J. Readiness

Avec la politique `OPTIONAL` :

- aucune section Finance : complete et non bloquante ;
- `DEFERRED` : complete et non bloquante ;
- `FEE_PLAN` compatible : complete ;
- contexte academique absent : `FINANCE_ACADEMIC_CONTEXT_REQUIRED` ;
- plan absent/supprime : `FEE_PLAN_NOT_AVAILABLE` ;
- plan d'une autre annee ou d'un autre niveau :
  `FEE_PLAN_NOT_COMPATIBLE`.

La readiness reste calculee par le backend. Une modification de la section
academique revalide aussi l'intention Finance deja stockee.

## K. Revalidation au finalize

La politique Finance relit le `FeePlan` dans la transaction Serializable de I3,
apres validation academique et avant les ecritures metier. Elle recontrole le
tenant, l'annee et le niveau. Un plan supprime ou devenu incompatible retourne
un conflit metier et annule toute la transaction.

Un test retire le plan apres la readiness puis confirme qu'aucun eleve,
responsable, lien, placement, inscription, facture ou paiement partiel n'est
cree.

## L. Transaction I3

La sequence transactionnelle reste : validation du dossier, validation
academique, validation Finance, ecritures identite/responsables, placement,
inscription legacy, confirmation, AuditLog et Outbox. La Finance n'introduit
aucun effet externe dans cette transaction.

## M. Generation Invoice

Decision I6 : aucune facture automatique. Le resultat contient toujours
`invoiceIds: []` et `invoiceGeneration: DEFERRED`.

Cette decision evite :

- une elevation implicite du role `SCOLARITE` vers `finance:create` ;
- une facture sans politique d'etablissement ;
- un doublon sans cle d'idempotence liee a l'admission ;
- la confusion entre confirmation scolaire et paiement.

## N. Idempotence

L'idempotence I3 s'applique au resultat Finance. Le rejeu de la meme cle et du
meme payload retourne exactement le meme resultat, sans facture ni paiement
supplementaire. L'idempotence de facture reste hors perimetre tant que la
creation automatique n'est pas retenue.

## O. Snapshot prix

Une facture existante conserve deja `amountDue`. I6 renvoie aussi le montant et
la devise relus lors du finalize pour tracer la decision, mais ne pretend pas
que ce resultat remplace une affectation financiere persistante. Une future
affectation devra figer explicitement le prix si elle devient une source metier.

## P. Echeanciers

Aucun echeancier n'est modelise. I6 n'en genere aucun et l'API declare
`schedule.supported=false`.

## Q. Remises

Aucune remise bornee, permissionnee et auditee n'existe dans ce domaine. I6 ne
permet aucune saisie libre et declare `discounts.supported=false`.

## R. Services complementaires

Cantine, transport, internat, assurance et uniforme ne sont pas modelises comme
options d'un `FeePlan`. I6 ne cree pas de catalogue parallele et declare
`services.supported=false`.

## S. RBAC

| Action | ADMIN | SCOLARITE | COMPTABLE |
| --- | --- | --- | --- |
| Lire les plans dans l'admission | oui | oui | non via les routes Admission |
| Selectionner un plan compatible | oui | oui | non via les routes Admission |
| Differer Finance | oui | oui | non via les routes Admission |
| Finaliser l'admission | oui | oui | non via les routes Admission |
| Creer directement une facture | oui selon permissions Finance | non | oui selon permissions Finance |
| Appliquer remise/exemption | non supporte | non supporte | non supporte |

Les surcharges de permissions existantes restent actives. I6 n'ajoute aucun
droit `finance:create` a `SCOLARITE`.

## T. SCOLARITE vs Finance

`SCOLARITE` peut choisir une reference existante ou differer le traitement,
mais la finalisation ne cree pas de facture en son nom. L'ecran Finance actuel
peut encore afficher des formulaires de creation avant un HTTP 403 ; cette
presentation des capacites doit etre corrigee dans le futur frontend I7 sans
elargir les permissions.

## U. Isolation tenant

Chaque lecture filtre `tenantId`. Un UUID de plan cross-tenant produit le meme
`FEE_PLAN_NOT_AVAILABLE` qu'un plan absent et n'en revele pas l'existence.
Les tests E2E confirment zero ecriture dans ce cas.

## V. AuditLog

`ADMISSION_CONFIRMED` trace seulement le mode Finance et le `feePlanId`
eventuel, en plus des identifiants techniques deja necessaires. Aucun montant
de paiement, secret, payload Finance complet ou donnee fournisseur n'est logue.

## W. Outbox

L'evenement durable `ADMISSION_CONFIRMED` porte le mode et le `feePlanId`. Aucun
`INVOICE_CREATED` n'est produit puisqu'aucune facture n'est creee. Aucun email,
SMS ou PDF n'est genere pendant la transaction.

## X. Migrations

Aucune migration I6. Le schema existant suffit au contrat d'intention retenu et
aucune ancienne migration n'a ete modifiee.

## Y. PostgreSQL

Une base PostgreSQL 16 jetable en tmpfs a recu les 39 migrations du depot depuis
zero. `prisma migrate status` confirme : 39 migrations trouvees et schema a
jour.

Une premiere execution complete avec les timeouts Jest historiques de 5 s a
montre des expirations de hooks sur un conteneur lent. Elle n'a pas ete masquee :
la suite a ete rejouee sans modifier le depot, sur une base tmpfs propre, avec
un timeout de commande de 120 s. Resultat final : 15 suites sur 15 et 111 tests
sur 111 reussis.

## Z. E2E I6

Les six scenarios I6 passent :

1. options compatibles et capacites `SCOLARITE` ;
2. refus plan incompatible et cross-tenant ;
3. finalisation avec plan, zero facture/paiement, audit/outbox et rejeu
   idempotent ;
4. modes differe et non specifie ;
5. plan supprime avant finalize avec rollback complet ;
6. reinscription N+1 sans mutation de la facture historique N.

## AA. Rollback

La validation Finance precede les ecritures metier dans la transaction. Une
erreur Finance ne laisse aucun objet partiel. Les points d'injection
assignment/invoice ne sont pas applicables puisque ces ecritures n'existent pas
en I6.

## AB. Non-regression I1-I5

Validations executees :

- Prisma format, validate et generate : PASS ;
- API typecheck, lint et build : PASS ;
- unitaires API complets : 38 suites, 228 tests, PASS ;
- E2E PostgreSQL complets : 15 suites, 111 tests, PASS ;
- deletion integrity incluse dans la suite complete : PASS ;
- `git diff --check` : PASS avant redaction du present rapport, puis rejoue en
  controle final.

## AC. Limites

1. Il n'existe pas de statut actif/archive sur `FeePlan`; I6 peut tester un plan
   supprime, mais pas un plan desactive.
2. La politique n'est pas configurable par tenant. Seule `OPTIONAL` est
   activee.
3. L'intention Finance n'est pas encore une affectation metier persistante.
4. Aucune cle d'idempotence de facture liee a l'admission n'existe.
5. Aucun echeancier, service, remise ou exemption robuste n'est disponible.
6. La devise par defaut du schema est `CFA`, meme si chaque plan/facture porte
   sa devise.
7. Le frontend Finance n'exploite pas encore les capacites pour masquer les
   actions interdites.

## AD. Decisions restant pour I7

1. Construire le wizard sur les contrats I1-I6 sans dupliquer les validations
   backend.
2. Afficher des libelles simples pour `FEE_PLAN` et `DEFERRED`.
3. Masquer les actions Finance selon `capabilities`, notamment la creation de
   facture pour `SCOLARITE`.
4. Afficher montant et devise du plan sans les rendre editables.
5. Ne pas presenter d'exemption, remise, service ou echeancier tant que le
   backend les declare non supportes.
6. Conserver la confirmation scolaire independante de tout paiement externe.

