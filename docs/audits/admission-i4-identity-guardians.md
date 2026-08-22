# LOT I4 - Identite eleve, responsables et matricule

Date de validation locale : 2026-08-23  
Perimetre : backend admission uniquement, PostgreSQL 16.14 jetable.  
Production, finance, documents, notifications et frontend : non modifies.

## A. Politique matricule

La politique retenue est `AUTO` par defaut, avec `MANUAL` comme option avancee
reservee au role `ADMIN`. `SCOLARITE` peut creer et finaliser une admission avec
un matricule automatique, mais ne peut ni imposer ni remplacer le matricule.

Le format actuel est `GST-YYYY-NNNNNN`, ou `YYYY` est l'annee de debut de
l'annee scolaire selectionnee. Le format est centralise dans le service eleve et
pourra evoluer sans modifier le contrat du brouillon (`matriculeMode`).

## B. Strategie de generation

La generation n'utilise jamais `COUNT(*) + 1`. La table technique
`student_matricule_counters` porte un compteur par `(tenant_id, academic_year)`.
L'allocation est un `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, execute dans
une transaction PostgreSQL courte. Le matricule est reserve sur
`admission_cases.reserved_matricule` avant la transaction metier I3.

Deux index PostgreSQL protegent la forme normalisee `upper(btrim(...))` :

- `uq_students_tenant_matricule_normalized` sur les eleves reels ;
- `uq_admission_cases_tenant_reserved_matricule` sur les reservations non nulles.

Une reservation abandonnee peut produire un trou de sequence. C'est volontaire :
les matricules restent uniques et stables, sans recycler un identifiant deja
expose par une tentative precedente.

## C. Concurrence matricule

Le test PostgreSQL lance six finalisations concurrentes. Les six matricules sont
distincts et tenant-scoped, aucune creation partielle n'est observee et le rejeu
avec la meme cle d'idempotence retourne le matricule initial. Les conflits de
serialisation Prisma `P2034` sont rejoues de facon bornee (huit tentatives avec
backoff court) ; l'echec final expose `ADMISSION_RETRY_REQUIRED`.

## D. Identite Student

Pour une `NEW_ADMISSION`, les champs obligatoires sont : prenom, nom, sexe et
date de naissance. Le matricule est obligatoire dans le resultat, mais produit
automatiquement sauf override ADMIN. Sont facultatifs : lieu de naissance,
nationalite, adresse, telephone, email et date d'admission. Sont avances :
identifiant interne, acte de naissance, besoins particuliers, langue principale
et notes administratives.

Les contraintes historiques du modele `Student` restent compatibles : aucune
colonne historique n'a ete rendue `NOT NULL` et aucun eleve existant n'est reecrit.

## E. Date de naissance

La date de naissance est obligatoire dans le dossier `NEW_ADMISSION`, car elle
est necessaire a l'identification fiable nom + prenom + naissance. Elle reste
nullable en base pour ne pas invalider les donnees historiques. Elle n'est pas
redemandee et n'est jamais modifiee par `RE_ENROLLMENT`.

## F. Anti-doublon Student

- matricule normalise identique : `EXACT_MATCH`, creation bloquee et code
  `STUDENT_EXACT_MATCH` en recherche ou `MATRICULE_CONFLICT` en finalisation ;
- nom + prenom + naissance : `POSSIBLE_MATCH` et
  `STUDENT_DUPLICATE_SUSPECTED` ;
- nom seul : signal informatif, jamais bloquant ;
- telephone ou email identique : suspicion a confirmer humainement ;
- aucune fusion ou selection automatique.

La contrainte PostgreSQL reste la protection finale contre une course sur le
matricule.

## G. Normalisation

`identity-normalization.ts` centralise les formes de comparaison : espaces
exterieurs et repetes, casse, email, chiffres du telephone et matricule. Les
accents ne sont pas supprimes et les valeurs metier affichees ne sont pas
reecrites pour la recherche. Les indices de contact et de document retournes par
l'API sont masques.

## H. Politique responsable

La politique est contextuelle : une `NEW_ADMISSION` exige au moins un
responsable valide avant `READY`, tandis qu'une `RE_ENROLLMENT` reutilise les
liens existants. Cette regle ne cree pas une contrainte universelle selon laquelle
tout `Student` historique doit avoir un parent.

## I. Responsable principal

Une nouvelle admission doit avoir exactement un responsable principal. Si un
seul responsable est fourni sans choix explicite, le backend le rend principal.
Avec plusieurs responsables, le choix doit etre explicite. Le service verifie la
regle et l'index PostgreSQL partiel existant du LOT 6 garantit au plus un lien
principal actif par eleve et tenant, y compris sous concurrence. Une collision
retourne `PRIMARY_GUARDIAN_CONFLICT`.

Relation familiale, responsable legal, contact principal, autorisation de
recuperation, responsabilite financiere et contact d'urgence restent des champs
distincts du modele actuel.

## J. Recherche Guardian

`GET /api/v1/admission-cases/search/guardians` recherche, dans le tenant courant,
par nom/prenom, telephone normalise, email normalise ou document. La reponse
retourne uniquement les informations de distinction utiles et des indices
masques. Aucun resultat d'un autre tenant n'est revele, meme si son UUID ou ses
coordonnees sont connus.

## K. NEW_GUARDIAN

Un nouveau responsable exige un role parental, prenom, nom, telephone principal
et type de relation. Telephone, email ou document identique produit
`GUARDIAN_DUPLICATE_SUSPECTED` ; aucune unicite artificielle n'est ajoutee sur
telephone ou email et aucun rattachement automatique n'est effectue.

## L. EXISTING_GUARDIAN

Un responsable existant est selectionne par UUID apres recherche. Le backend
revalide son existence, son statut actif et son appartenance au tenant dans la
transaction de finalisation. Le meme responsable ne peut pas etre selectionne
deux fois dans le dossier.

## M. ParentStudentLink

Les codes stables exposes sont `PERE`, `MERE`, `TUTEUR`,
`RESPONSABLE_LEGAL` et `AUTRE`. Les regles existantes sont conservees : lien actif
unique, tenant concordant, plusieurs enfants par responsable, plusieurs
responsables par eleve, et un seul principal actif. Aucune regle de suppression
ou d'archivage validee precedemment n'est modifiee.

## N. NEW_ADMISSION

Le parcours reste : `AdmissionCase` persistant -> sections STUDENT/GUARDIANS/
ACADEMICS -> evaluation backend `READY` -> reservation technique du matricule ->
`finalize` I3. Aucune ligne `Student`, `Parent`, `ParentStudentLink`, placement ou
inscription n'est creee pendant l'edition du brouillon. La transaction I3 cree
ensemble les objets metier, l'audit et l'outbox.

## O. RE_ENROLLMENT

La reinscription exige un eleve existant du tenant. Elle refuse toute section
STUDENT ou GUARDIANS non vide, reutilise l'identite et les liens existants, et ne
cree que le nouvel historique scolaire. Les tests comparent l'identite et les
liens avant/apres et confirment leur invariance.

## P. FAILED et retry

`POST /api/v1/admission-cases/:id/reopen` accepte la version optimiste du dossier.
Une erreur metier corrigeable repasse par l'evaluation backend et devient `DRAFT`
ou `READY` ; le frontend ne peut pas imposer l'etat. Une erreur technique ou une
course non resolue conserve la cle d'idempotence et exige un rejeu de
finalisation, signale par `ADMISSION_RETRY_REQUIRED`.

La reservation automatique est effacee lors d'une reouverture corrigeable et
conservee lors d'un retry technique, ce qui stabilise le matricule.

## Q. RBAC

ADMIN et SCOLARITE, avec les permissions existantes, peuvent creer/lire/modifier
un dossier, rechercher eleves et responsables, finaliser et reprendre une erreur
corrigeable. Seul ADMIN peut utiliser `matriculeMode=MANUAL`. Les roles finance
n'obtiennent aucun droit d'admission ou de recherche d'identite.

## R. Codes d'erreur

Les codes stabilises comprennent : `STUDENT_EXACT_MATCH`,
`STUDENT_DUPLICATE_SUSPECTED`, `GUARDIAN_DUPLICATE_SUSPECTED`,
`GUARDIAN_REQUIRED`, `PRIMARY_GUARDIAN_REQUIRED`,
`PRIMARY_GUARDIAN_CONFLICT`, `MATRICULE_CONFLICT`,
`MATRICULE_OVERRIDE_FORBIDDEN`, `MATRICULE_SEQUENCE_EXHAUSTED`,
`ADMISSION_RETRY_REQUIRED` et `ADMISSION_SEARCH_CRITERIA_REQUIRED`.

## S. Migration PostgreSQL

Migration : `20260822230000_admission_identity_guardians`.

- preflight en lecture seule avant le `BEGIN`, avec erreur explicite
  `I4_DUPLICATE_NORMALIZED_STUDENT_MATRICULE` ;
- toutes les modifications de schema et l'initialisation des compteurs sont
  transactionnelles ;
- aucune valeur Student, Parent ou ParentStudentLink n'est modifiee ;
- base vierge : 39/39 migrations appliquees ;
- base preexistante : 38 -> 39, 2 Students, 1 Parent et 1 lien conserves avec
  empreintes identiques, compteur 2026 initialise a 124 ;
- base contenant un doublon normalise : migration bloquee, 0 colonne/table/index
  I4 residuel et 2 lignes synthetiques conservees.

Rollback avant deploiement du code I4 : supprimer les deux index I4, supprimer
`admission_cases.reserved_matricule`, puis supprimer la table technique de
compteurs dans une transaction. Ce rollback perd uniquement les reservations et
compteurs techniques ; il ne doit pas etre execute apres reprise des admissions
sans decision operationnelle.

## T. E2E PostgreSQL

- I1-I4 cible : 3 suites, 27/27 tests ;
- I4 : recherche et masquage, birth date/readiness, six matricules concurrents,
  nouveau/existant/multiples responsables, principal concurrent, reinscription,
  reouverture/retry FAILED ;
- suite PostgreSQL complete : 13 suites, 100/100 tests ;
- deletion integrity ciblee : 1 suite, 10/10 tests ;
- tests unitaires API : 36 suites, 216/216 tests.

## U. Non-regression I3

Double finalize, rejeu idempotent, cle contradictoire, matrice de rollback,
placement concurrent, classe desactivee, isolation tenant, NEW_ADMISSION et
RE_ENROLLMENT sont couverts et verts. La reservation du matricule est technique
et courte ; la creation Student/Guardian/Link/Placement/Enrollment/Audit/Outbox
reste dans la transaction serializable I3.

## V. Decisions restantes

- I5/UI : construire l'assistant autour des contrats existants, traduire les
  codes de relation et d'erreur, afficher les suspicions sans fusion automatique ;
- I6/Finance : traiter separement tarifs, factures et paiements ;
- Documents : conserver le chantier upload/storage separe ;
- Produit : confirmer avant ouverture multi-etablissements si le prefixe `GST`
  doit devenir configurable. Aucun changement n'est necessaire pour l'unicite.

Verdict local LOT I4 : **GO technique**, sans production, commit ni push.
