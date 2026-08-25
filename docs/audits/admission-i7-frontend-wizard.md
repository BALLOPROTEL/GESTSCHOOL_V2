# LOT I7 - Assistant frontend d'inscription 360 degres

Date de validation locale : 2026-08-23

Perimetre : frontend GestSchool et fixtures d'audit visuel strictes. Aucun fichier backend,
schema Prisma, migration, contrat API, fournisseur, paiement, upload ou configuration de
deploiement n'est modifie.

## A. Architecture frontend

L'ecran Inscriptions conserve sa liste, ses filtres, ses consultations et son formulaire
legacy de modification. Le CTA principal `Nouvelle inscription` charge paresseusement un
assistant dedie. La creation directe legacy n'est plus le point d'entree d'une nouvelle
inscription.

L'assistant orchestre cinq etapes : Eleve, Responsable, Scolarite, Frais et Recapitulatif.
Les donnees de saisie restent locales jusqu'au clic `Continuer`; chaque transition attend
la sauvegarde de section par le backend avant d'avancer.

## B. Routes

Le routeur courant selectionne des ecrans a partir de `/app/enrollments`; il ne possede pas
de sous-routeur metier. I7 n'ajoute donc pas une architecture URL parallele. L'ouverture et
la reprise sont integrees a l'ecran existant. Une URL profonde vers un dossier precis reste
une limite a traiter avec l'evolution coordonnee du routeur, sans inventer un contrat local.

## C. Service Admission

`admission-service.ts` encapsule strictement les contrats I1 a I6 : preflight, creation,
liste, lecture, sauvegarde versionnee des sections, annulation logique, reopen, finalize,
recherche Eleve/Responsable et options academiques/financieres. Les types sont explicites,
sans `any`. `AdmissionApiError` conserve le code stable et le statut HTTP; le message brut
du backend n'est jamais rendu a l'utilisateur.

## D. Wizard

Le composant racine gere les phases chargement, blocage, choix du mode, assistant et succes.
Le stepper expose l'etape courante avec `aria-current`, une progression native et un etat de
sauvegarde `aria-live`. Les erreurs reseau gardent la saisie et l'etape courante.

Un audit visuel a revele puis permis de corriger une boucle de relecture du meme brouillon :
le bootstrap depend maintenant de l'identifiant stable et non de la representation objet ou
de l'identite du callback parent. Un test de non-regression couvre ce comportement.

Le runner navigateur authentifie a egalement revele une boucle preexistante de chargement de
la liste legacy lorsque `initialEnrollments` recevait une nouvelle reference apres la reponse.
Le hook conserve maintenant la derniere valeur dans une ref sans recreer son loader : le
scenario complet passe de 166 a 4 lectures attendues, avec un test composant et un seuil dans
le runner pour empecher sa reintroduction.

## E. NEW_ADMISSION

Apres le preflight, le choix `Inscrire un nouvel eleve` cree immediatement un brouillon.
L'identite minimale est prenom, nom, sexe et date de naissance. Le matricule reste automatique
par defaut; l'override manuel n'est visible que pour ADMIN.

## F. RE_ENROLLMENT

La recherche n'auto-selectionne aucun resultat. Le contrat de creation I2 exige `studentId`
pour `RE_ENROLLMENT`; la creation du brouillon intervient donc apres selection et confirmation
explicites de l'eleve. L'identite n'est pas reeditee. Les responsables sont annonces comme
conserves en lecture seule, car le contrat I4 ne retourne pas leur liste dans ce parcours.

## G. Student search

La recherche est declenchee explicitement, avec chargement local, aucun-resultat, correspondance
possible et choix explicite. Aucun rapprochement automatique n'est effectue. Le code
`STUDENT_DUPLICATE_SUSPECTED` est traduit et permet de basculer volontairement vers la
reinscription lorsque le backend l'autorise.

## H. Guardian

Le responsable peut etre recherche ou ajoute dans le brouillon. Les codes de relation restent
ceux du contrat. Un seul responsable devient automatiquement principal; avec plusieurs cartes,
le choix principal reste explicite et unique. Retirer une carte ne supprime jamais une entite
Parent existante.

## I. Academics

Les options sont demandees progressivement au backend : annee, cursus, niveau, classe. Un
changement invalide les choix descendants. Les warnings de capacite restent informatifs et
la disponibilite finale reste decidee par I5.

## J. Finance

L'etape propose exclusivement `Appliquer un plan de frais` ou `Traiter les frais plus tard`.
Les plans viennent d'I6. I7 ne cree ni facture, ni paiement, ni plan, ni transaction.

## K. Review

Le recapitulatif presente les quatre sections en termes metier et permet de revenir a chacune.
La confirmation n'est disponible que lorsque le dossier renvoye par le backend est pret.

## L. Finalize

Le finalize envoie `expectedVersion` et attend le resultat contractuel I3. Une modification
corrigeable conserve l'identite logique du dossier et respecte le mecanisme `reopen` du backend.

## M. Success

L'ecran confirme l'inscription et affiche uniquement les informations garanties par le resultat
I3. `Inscrire un autre eleve` remet l'assistant a zero sans recharger toute l'application.
Aucune route inexistante n'est inventee.

## N. Draft resume

La liste active charge les dossiers DRAFT, READY et FAILED, avec mode, progression backend,
date, statut et action Reprendre/Corriger. CANCELLED et CONFIRMED ne polluent pas cette liste.
La reprise relit la version la plus recente et ouvre la premiere section incomplete.

## O. Cancel

L'annulation demande confirmation puis appelle l'endpoint logique I2. Elle ne supprime ni le
dossier ni une entite metier.

## P. Failed et reopen

Les codes de finalisation sont traduits. Une erreur retryable propose `Reessayer`; une erreur
corrigeable propose `Corriger le dossier` et appelle `reopen`. Aucun passage local force de
FAILED vers READY n'existe.

## Q. Optimistic locking

Chaque PATCH envoie la version courante. `ADMISSION_VERSION_CONFLICT` bloque la navigation et
propose soit de relire le serveur, soit d'abandonner les changements locaux. Aucun merge
silencieux n'est tente.

## R. Idempotence frontend

La cle deterministe `admission-finalize:<caseId>` reste stable pour le dossier. Un double clic
est bloque par l'etat de traitement et un retry du meme dossier reutilise la meme cle.

## S. RBAC

Le preflight et les capacites backend restent la source de verite. Le role frontend sert
uniquement a masquer l'override de matricule pour SCOLARITE. Aucun quick create Finance ou
Referentiel n'est ajoute.

## T. I18n

Le catalogue existant contient les libelles, aides, warnings, erreurs et actions I7 en FR, EN
et AR. Un test parcourt toutes les nouvelles entrees dans les trois langues. Les donnees libres
(noms, matricules) ne sont jamais traduites.

## U. RTL

Le CSS emploie les proprietes logiques, les controles et le stepper suivent la direction du
document, et le parcours arabe Playwright verifie explicitement `dir=rtl`. Le shell certifie
R8 reste la source de verite pour la direction globale.

## V. Accessibilite

Les formulaires ont des labels natifs, les recherches utilisent `role=search`, les resultats
et sauvegardes sont annonces poliment, les erreurs utilisent `role=alert`, les choix utilisent
les controles natifs et les cibles principales respectent les fondations tactiles. La boite de
confirmation reutilise le focus trap et la restauration de focus existants.

## W. Responsive et themes

Le wizard reutilise les breakpoints canoniques `767` et `1023`, sans breakpoint ad hoc, sans
overflow masque et sans nouvel `!important`. Mobile est en une colonne, tablette conserve un
stepper lisible et desktop limite la largeur du contenu. Clair, sombre et RTL reutilisent les
tokens globaux.

## X. Performance

L'assistant est lazy-load depuis l'ecran Inscriptions. Le build produit un chunk dedie
`admission-wizard` de 35 534 octets brut / 8 947 octets gzip. Le chunk Inscriptions reste
distinct (27 469 / 8 513 octets). Le CSS I7 pese 10 400 octets source, environ 2 092 octets
gzip, sans modifier silencieusement le budget du CSS legacy.

Une reconstruction temporaire du `HEAD` pre-I7 mesure le JS principal a 460 171 octets brut /
133 977 octets gzip, contre 484 217 / 139 914 octets apres I7 : +5,22 % brut et +4,43 % gzip. Le delta
brut legerement superieur a 5 % vient principalement du catalogue FR/EN/AR, conserve dans
le dictionnaire i18n monolithique existant. Le code fonctionnel du wizard reste dans son
chunk lazy et les budgets R9 passent (JS initial 139 914 / 145 000 octets gzip; CSS initial
71 657 / 75 000).

## Y. Comparaison ancien / nouveau

Avant, une admission standard demandait typiquement quatre a six modules et douze a dix-huit
actions majeures. Apres I7, elle reste dans un assistant de cinq etapes plus confirmation,
sans changement de module. Un parcours simple represente environ vingt a trente interactions
de saisie/selection et vise trois a cinq minutes; cette estimation UX n'est pas un benchmark
terrain.

## Z. Tests

- Service Admission : 4 tests.
- Etapes : 14 tests.
- Orchestrateur : 10 tests, dont boucle de relecture, preflight, NEW, RE, reprise, conflit,
  annulation, echec/reopen et finalisation.
- Total cible I7 service/etapes/orchestrateur : 28 tests.
- Scenarios A a H : 8/8 PASS dans le runner Playwright deterministe dedie, avec session locale
  authentifiee non-preview, API strictement mockee, zero requete imprevue et allowlist vide.
- E2E UI + API + PostgreSQL reel : non ajoute, car aucun harnais frontend integre sur base
  jetable ne permet de le faire sans elargir I7; reserve a I9.

## Validations finales

- Typecheck frontend : PASS.
- Lint frontend : PASS.
- Tests frontend complets : 43 fichiers, 245/245 PASS.
- Tests cibles I7 et i18n : 4 fichiers, 43/43 PASS.
- Build avec origines explicites : PASS.
- Smoke et CSP : PASS.
- Audit visuel CI strict : 89/89, zero constat, allowlist vide.
- Audit responsive complet : 166/166, zero constat, allowlist vide.
- Audit accessibilite R8 : 135/135, zero constat, allowlist vide.
- Parcours Playwright Admission A-H : 8/8, zero constat, zero requete API imprevue,
  allowlist vide.
- Budget performance R9 : PASS.
- `git diff --check` : PASS.

## Limites et suite I8

I8 pourra traiter uniquement les finitions confirmees par usage : deep-linking coordonne avec
le routeur, quick create de classe si un endpoint adapte est decide, et documents lorsqu'un
contrat produit existe. I8 ne doit pas contourner les limites I4 sur les responsables de
reinscription. I9 devra fournir le scenario UI vers API/PostgreSQL reel sur base jetable.

Message de commit propose :

`feat(web-admin): add end-to-end admission wizard`
