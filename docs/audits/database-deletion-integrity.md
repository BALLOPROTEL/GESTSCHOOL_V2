# Audit d'intégrité des suppressions PostgreSQL

Date : 2026-08-14

Périmètre : API NestJS, schéma Prisma, 86 clés étrangères PostgreSQL, services de
suppression et appels frontend. L'audit du catalogue a été exécuté uniquement sur
un PostgreSQL 16 jetable contenant les 35 migrations existantes. Aucune base
distante ou de production n'a été consultée ou modifiée.

## Diagnostic initial

Le catalogue PostgreSQL comptait 86 clés étrangères : 16 `CASCADE`, 28
`NO ACTION`, 10 `RESTRICT` et 32 `SET NULL`.

| Relation | État initial | Risque démontré | Stratégie retenue |
| --- | --- | --- | --- |
| `refresh_tokens.user_id -> users.id` | `NO ACTION` | bloque la suppression physique d'un compte | `CASCADE`, donnée technique sans valeur autonome |
| `user_security_tokens.user_id -> users.id` | `CASCADE` | aucun | conserver `CASCADE` |
| profils enseignant/parent/élève -> `users` | `SET NULL` | aucun | conserver le profil métier et détacher le compte |
| audits IAM et événements outbox -> `users` | `SET NULL` | aucun | conserver l'historique |
| `notifications.student_id -> students.id` | `NO ACTION` | bloque un profil élève pourtant sans autre historique | `SET NULL`, notification conservée |
| placements -> élève | `CASCADE` | suppression silencieuse d'historique scolaire | `RESTRICT` |
| placements -> année scolaire | `CASCADE` | suppression silencieuse d'historique scolaire | `RESTRICT` |
| règles pédagogiques -> année/cycle/niveau/classe | quatre `CASCADE` | divergence avec Prisma et perte de règles | quatre `SET NULL` |
| documents enseignant -> enseignant | `CASCADE` | métadonnées supprimées mais objet privé potentiellement orphelin | `RESTRICT` et suppression explicite du document |
| justificatifs -> absence | `CASCADE` | objet privé potentiellement orphelin | `RESTRICT` et suppression explicite avec compensation |
| liens parent/élève -> parent | `SET NULL` | relation historique sans profil parent identifiable | `RESTRICT` |
| liens parent/élève -> élève | `CASCADE` | disparition silencieuse de la relation familiale | `RESTRICT` |

Après migration, la matrice attendue est : 8 `CASCADE`, 26 `NO ACTION`, 16
`RESTRICT` et 36 `SET NULL`. Les cascades restantes sont limitées aux artefacts
techniques ou sous-ressources sans vie autonome : jetons, tentatives de livraison,
compétences enseignant, scopes matière/niveau et disponibilités de salle. Les
entités financières, scolaires, de présence, d'affectation, de document et d'audit
restent protégées par `RESTRICT`/`NO ACTION` ou conservées par `SET NULL`.

## Flux applicatifs

| Flux | Diagnostic | Correction |
| --- | --- | --- |
| utilisateur | `DELETE` faisait un archivage, puis l'UI masquait la ligne ; une suppression SQL directe échouait sur `refresh_tokens` | suppression physique transactionnelle, jetons en cascade, profils et historique détachés, objet avatar nettoyé après commit |
| élève | `DELETE` faisait un archivage | `POST /students/:id/archive` archive ; `DELETE` supprime uniquement un profil sans compte ni historique, sinon `409` |
| enseignant | `DELETE` faisait un archivage | endpoint d'archive explicite ; suppression physique seulement sans compte, affectation ou document ; compétences subordonnées en cascade |
| parent | `DELETE` faisait un archivage | endpoint d'archive explicite ; suppression physique seulement sans compte ni lien familial |
| affectations/documents enseignant | UI annonçait parfois « supprimé » alors que le service archivait | appels et libellés d'archive explicites ; l'ancien `DELETE` renvoie un conflit stable |
| salles/affectations de salle | une salle était annoncée supprimée alors qu'elle était archivée | appels `POST .../archive` et succès « archivé » ; disponibilité reste une vraie suppression |
| placement + inscription legacy | deux suppressions successives pouvaient s'exécuter hors transaction | transaction Prisma unique transmise au service de structure académique |
| note + bulletins dérivés | la note était supprimée avant la resynchronisation ; un échec ultérieur produisait une suppression partielle | suppression et resynchronisation exécutées avec le même client transactionnel Prisma |
| référentiels/finance/mosquée | suppression physique déjà protégée par les FK et conversion `P2003` | comportement conservé |
| absences et fichiers | suppression d'absence déjà bloquée si un justificatif existe ; une création concurrente pouvait toutefois produire un `P2003`/500 | FK renforcée en `RESTRICT`, conflit explicite et course `P2003` convertis en `409`, suppression de fichier compensée |

## Contrat d'erreur

Les courses résiduelles de clé étrangère (`P2003`) sont converties en `409
Conflict`. Les codes stables suivants sont traduits côté frontend en FR, EN et AR ;
le message technique du backend n'est jamais affiché directement :

- `ENTITY_DELETE_RESTRICTED`
- `ENTITY_DELETE_LINKED_ACCOUNT`
- `ENTITY_REQUIRES_ARCHIVE`
- `USER_DELETE_SELF_FORBIDDEN`

## Migration et rollback

La migration `20260814120000_deletion_referential_integrity` est transactionnelle
et ne modifie aucune ligne. Elle remplace uniquement les actions `ON DELETE` des
12 contraintes listées ci-dessus. Les migrations historiques ne sont pas modifiées.

Rollback, uniquement avant reprise du trafic : restaurer les actions précédentes
dans une transaction (`refresh_tokens` et `notifications` en `NO ACTION`, placements,
règles pédagogiques, documents enseignant, justificatifs et lien élève en `CASCADE`,
lien parent en `SET NULL`), puis redéployer l'ancienne version. Un rollback après
reprise des écritures exige un nouvel audit, car il réintroduit des cascades reconnues
comme dangereuses.

## Limites

- Une suppression d'utilisateur qui réussit en base peut laisser un objet avatar
  orphelin si le fournisseur de stockage échoue après le commit ; l'échec est
  journalisé et ne transforme pas un succès PostgreSQL en faux échec HTTP.
- Les anciennes routes `DELETE` d'entités volontairement archivables sont
  conservées temporairement pour renvoyer un `409` explicite. Elles pourront être
  retirées après confirmation qu'aucun client externe ne les utilise.
- Aucun test ni migration n'est exécuté contre la production dans ce lot.

## Validation locale

Contrôles réussis :

- `prisma validate` et `prisma generate` ;
- typecheck, lint, build et 187 tests unitaires API ;
- typecheck, lint, build et 215 tests frontend ;
- tests ciblés du contrat `409`, des transactions placement/inscription et
  note/bulletins, ainsi que des routes explicites archive/suppression ;
- `git diff --check`.

Le scénario E2E PostgreSQL comporte sept tests qui vérifient les lignes après
chaque opération : utilisateur et jetons, élève et notification conservée,
enseignant et compétences, document enseignant bloquant, parent et lien familial,
ainsi que l'absence de faux succès pour l'archivage. Son exécution et l'application
de la migration au PostgreSQL Docker jetable ont été bloquées par l'autorisation
d'exécution de l'environnement. Elles restent donc obligatoires avant commit ou
déploiement ; ce blocage ne constitue pas un résultat de test réussi.
