import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type {
  ParentRecord,
  ParentStudentRelation,
  Student,
  UserAccount,
  WorkflowStepDef
} from "../shared/types/app";
import { WorkflowGuide } from "../shared/components/workflow-guide";
import { ParentsListSection } from "./parents/components/parents-list-section";
import {
  archiveParentRecord,
  archiveParentStudentLink,
  createParentStudentLink,
  fetchParentsModule,
  saveParent
} from "./parents/parents-service";
import {
  PARENT_ROLES,
  PARENT_RELATIONS,
  PARENT_STATUSES,
  type ParentForm,
  type ParentLinkForm,
  buildStudentOption,
  defaultLinkForm,
  defaultParentForm,
  roleLabel,
  statusLabel,
  statusPillClassName,
  trackLabel
} from "./parents/parents-screen-model";
import { useI18n } from "../shared/i18n-context";


type ParentsScreenProps = {
  api: (path: string, init?: RequestInit) => Promise<Response>;
  initialParents?: ParentRecord[];
  initialRelations?: ParentStudentRelation[];
  remoteEnabled?: boolean;
  students: Student[];
  users: UserAccount[];
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onParentsChanged?: () => Promise<void> | void;
};

const normalizeParentsError = (error: unknown, fallback: string): string => {
  const message = error instanceof Error ? error.message : fallback;
  return /invalid or expired token|session expiree|session expirée/i.test(message)
    ? "Session expirée. Merci de vous reconnecter."
    : message;
};

const formatRelationRoles = (relation: ParentStudentRelation): string => {
  const roles = [
    relation.isPrimaryContact ? "Contact principal" : "",
    relation.legalGuardian ? "Tuteur légal" : "",
    relation.financialResponsible ? "Responsable financier" : "",
    relation.emergencyContact ? "Contact d’urgence" : "",
    relation.pickupAuthorized ? "Autorisé à récupérer l’élève" : "",
    relation.livesWithStudent ? "Vit avec l’élève" : ""
  ].filter(Boolean);
  return roles.join(", ") || "-";
};

const formatStudentTracks = (relation: ParentStudentRelation): string => {
  const tracks =
    relation.studentTracks.length > 0
      ? relation.studentTracks
      : relation.studentPlacements.map((placement) => placement.track);
  const uniqueTracks = tracks.filter((track, index, allTracks) => allTracks.indexOf(track) === index);
  return uniqueTracks.length > 0 ? uniqueTracks.map(trackLabel).join(" + ") : "À régulariser via inscription";
};

export function ParentsScreen({
  api,
  initialParents = [],
  initialRelations = [],
  onError,
  onNotice,
  onParentsChanged,
  remoteEnabled = true,
  students,
  users
}: ParentsScreenProps): JSX.Element {
  const { t: tr } = useI18n();
  const [activeStep, setActiveStep] = useState("list");
  const [parents, setParents] = useState<ParentRecord[]>(initialParents);
  const [relations, setRelations] = useState<ParentStudentRelation[]>(initialRelations);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedParentId, setSelectedParentId] = useState("");
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [parentForm, setParentForm] = useState<ParentForm>(defaultParentForm);
  const [linkForm, setLinkForm] = useState<ParentLinkForm>(defaultLinkForm);

  const portalParentUsers = useMemo(
    () => users.filter((user) => user.role === "PARENT" && user.isActive),
    [users]
  );
  const selectedParent = parents.find((parent) => parent.id === selectedParentId);
  const shownParents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parents;
    return parents.filter((parent) =>
      [
        parent.fullName,
        parent.primaryPhone,
        parent.secondaryPhone,
        parent.email,
        roleLabel(parent.parentalRole)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [parents, search]);

  const loadData = useCallback(async () => {
    if (!remoteEnabled) {
      setParents(initialParents);
      setRelations(initialRelations);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchParentsModule(api);
      setParents(data.parents);
      setRelations(data.relations);
    } catch (error) {
      onError(normalizeParentsError(error, "Impossible de charger les responsables."));
    } finally {
      setLoading(false);
    }
  }, [api, initialParents, initialRelations, onError, remoteEnabled]);

  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      if (cancelled) return;
      await loadData();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const resetParentForm = (): void => {
    setEditingParentId(null);
    setParentForm(defaultParentForm());
  };

  const submitParent = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (
      !parentForm.parentalRole ||
      !parentForm.firstName.trim() ||
      !parentForm.lastName.trim() ||
      !parentForm.primaryPhone.trim() ||
      !parentForm.status
    ) {
      onError("Rôle parental, prénom, nom, téléphone principal et statut sont requis.");
      return;
    }

    const payload = {
      parentalRole: parentForm.parentalRole,
      firstName: parentForm.firstName.trim(),
      lastName: parentForm.lastName.trim(),
      sex: parentForm.sex || undefined,
      primaryPhone: parentForm.primaryPhone.trim(),
      secondaryPhone: parentForm.secondaryPhone.trim() || undefined,
      email: parentForm.email.trim() || undefined,
      address: parentForm.address.trim() || undefined,
      profession: parentForm.profession.trim() || undefined,
      identityDocumentType: parentForm.identityDocumentType.trim() || undefined,
      identityDocumentNumber: parentForm.identityDocumentNumber.trim() || undefined,
      status: parentForm.status,
      establishmentId: parentForm.establishmentId || undefined,
      userId: parentForm.userId || undefined,
      notes: parentForm.notes.trim() || undefined
    };

    if (!remoteEnabled) {
      onNotice("Mode aperçu local : responsable non persisté.");
      setActiveStep("list");
      return;
    }

    try {
      await saveParent(api, editingParentId, payload);
    } catch (error) {
      onError(normalizeParentsError(error, "Impossible d’enregistrer le responsable."));
      return;
    }

    resetParentForm();
    onNotice(editingParentId ? "Responsable modifié." : "Responsable créé.");
    await loadData();
    await onParentsChanged?.();
    setActiveStep("list");
  };

  const editParent = (parent: ParentRecord): void => {
    setEditingParentId(parent.id);
    setParentForm({
      parentalRole: parent.parentalRole,
      firstName: parent.firstName,
      lastName: parent.lastName,
      sex: parent.sex === "M" || parent.sex === "F" ? parent.sex : "",
      primaryPhone: parent.primaryPhone,
      secondaryPhone: parent.secondaryPhone || "",
      email: parent.email || "",
      address: parent.address || "",
      profession: parent.profession || "",
      identityDocumentType: parent.identityDocumentType || "",
      identityDocumentNumber: parent.identityDocumentNumber || "",
      status: parent.status,
      establishmentId: parent.establishmentId || "",
      userId: parent.userId || "",
      notes: parent.notes || ""
    });
    setSelectedParentId(parent.id);
    setActiveStep("entry");
  };

  const archiveParent = async (parentId: string): Promise<void> => {
    if (!window.confirm("Archiver ce responsable ?")) return;
    if (!remoteEnabled) {
      onNotice("Mode aperçu local : archivage non persisté.");
      return;
    }
    try {
      await archiveParentRecord(api, parentId);
    } catch (error) {
      onError(normalizeParentsError(error, "Impossible d’archiver le responsable."));
      return;
    }
    onNotice("Responsable archivé.");
    if (selectedParentId === parentId) setSelectedParentId("");
    await loadData();
    await onParentsChanged?.();
  };

  const submitLink = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!linkForm.parentId || !linkForm.studentId || !linkForm.relationType) {
      onError("Parent, élève et relation sont requis pour créer le lien.");
      return;
    }

    if (!remoteEnabled) {
      onNotice("Mode aperçu local : lien parent-élève non persisté.");
      return;
    }

    try {
      await createParentStudentLink(api, {
        parentId: linkForm.parentId,
        studentId: linkForm.studentId,
        relationType: linkForm.relationType,
        isPrimaryContact: linkForm.isPrimaryContact,
        livesWithStudent: linkForm.livesWithStudent,
        pickupAuthorized: linkForm.pickupAuthorized,
        legalGuardian: linkForm.legalGuardian,
        financialResponsible: linkForm.financialResponsible,
        emergencyContact: linkForm.emergencyContact,
        comment: linkForm.comment.trim() || undefined
      });
    } catch (error) {
      onError(normalizeParentsError(error, "Impossible de créer le lien parent-élève."));
      return;
    }

    setLinkForm((previous) => ({
      ...defaultLinkForm(),
      parentId: previous.parentId,
      studentId: previous.studentId
    }));
    onNotice("Lien parent-élève créé.");
    await loadData();
    await onParentsChanged?.();
  };

  const archiveLink = async (linkId: string): Promise<void> => {
    if (!window.confirm("Archiver ce lien parent-élève ?")) return;
    if (!remoteEnabled) {
      onNotice("Mode aperçu local : archivage du lien non persisté.");
      return;
    }
    try {
      await archiveParentStudentLink(api, linkId);
    } catch (error) {
      onError(normalizeParentsError(error, "Impossible d’archiver le lien parent-élève."));
      return;
    }
    onNotice("Lien parent-élève archivé.");
    await loadData();
    await onParentsChanged?.();
  };

  const steps: WorkflowStepDef[] = [
    {
      id: "list",
      title: "Liste des responsables",
      hint: "Identifier les responsables métier.",
      done: parents.length > 0
    },
    {
      id: "entry",
      title: editingParentId ? "Modifier le responsable" : "Ajouter un responsable",
      hint: "Créer une fiche responsable distincte du compte portail.",
      done: parents.length > 0
    },
    {
      id: "links",
      title: "Liens parent-élève",
      hint: "Déclarer les responsables par élève.",
      done: relations.length > 0
    }
  ];

  return (
    <WorkflowGuide
      title={tr("Parents")}
      steps={steps}
      activeStepId={activeStep}
      onStepChange={setActiveStep}
      className="module-v3-workflow"
    >
      <div className="students-screen-shell parents-screen-shell module-v3-shell">
        {activeStep === "list" ? (
          <ParentsListSection
            loading={loading}
            onArchiveParent={(parentId) => void archiveParent(parentId)}
            onEditParent={editParent}
            onSearchChange={setSearch}
            onSelectParent={setSelectedParentId}
            search={search}
            selectedParent={selectedParent}
            shownParents={shownParents}
          />
        ) : null}

        {activeStep === "entry" ? (
          <section className="panel editor-panel workflow-section module-modern parents-entry-panel">
            <div className="table-header">
              <div>
                <p className="section-kicker">{tr("Fiche responsable")}</p>
                <h2>{editingParentId ? tr("Modifier le responsable") : tr("Ajouter un responsable")}</h2>
              </div>
              <span className="students-overview-status">{tr("Dossier responsable")}</span>
            </div>
            <form className="module-form parents-form" onSubmit={(event) => void submitParent(event)}>
              <fieldset className="students-form-section parents-form-section">
                <legend>{tr("Identité")}</legend>
                <div className="form-grid students-form-grid">
                  <label>
                    {tr("Rôle parental *")}<select
                      required
                      value={parentForm.parentalRole}
                      onChange={(event) => setParentForm((prev) => ({ ...prev, parentalRole: event.target.value }))}
                    >
                      {PARENT_ROLES.map((role) => (
                        <option key={role} value={role}>{tr(roleLabel(role))}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {tr("Prénom *")}<input
                      required
                      value={parentForm.firstName}
                      onChange={(event) => setParentForm((prev) => ({ ...prev, firstName: event.target.value }))}
                    />
                  </label>
                  <label>
                    {tr("Nom *")}<input
                      required
                      value={parentForm.lastName}
                      onChange={(event) => setParentForm((prev) => ({ ...prev, lastName: event.target.value }))}
                    />
                  </label>
                  <label>
                    {tr("Sexe")}<select
                      value={parentForm.sex}
                      onChange={(event) => setParentForm((prev) => ({ ...prev, sex: event.target.value as "" | "M" | "F" }))}
                    >
                      <option value="">{tr("Non renseigné")}</option>
                      <option value="M">{tr("M")}</option>
                      <option value="F">{tr("F")}</option>
                    </select>
                  </label>
                </div>
              </fieldset>

              <fieldset className="students-form-section parents-form-section">
                <legend>{tr("Contact")}</legend>
                <div className="form-grid students-form-grid">
                  <label>
                    {tr("Téléphone principal *")}<input
                      required
                      value={parentForm.primaryPhone}
                      onChange={(event) => setParentForm((prev) => ({ ...prev, primaryPhone: event.target.value }))}
                    />
                  </label>
                  <label>
                    {tr("Téléphone secondaire")}<input
                      value={parentForm.secondaryPhone}
                      onChange={(event) => setParentForm((prev) => ({ ...prev, secondaryPhone: event.target.value }))}
                    />
                  </label>
                  <label>
                    {tr("Email")}<input
                      type="email"
                      value={parentForm.email}
                      onChange={(event) => setParentForm((prev) => ({ ...prev, email: event.target.value }))}
                    />
                  </label>
                  <label className="span-2">
                    {tr("Adresse")}<input
                      value={parentForm.address}
                      onChange={(event) => setParentForm((prev) => ({ ...prev, address: event.target.value }))}
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="students-form-section parents-form-section">
                <legend>{tr("Informations complémentaires")}</legend>
                <div className="form-grid students-form-grid">
                  <label>
                    {tr("Profession")}<input
                      value={parentForm.profession}
                      onChange={(event) => setParentForm((prev) => ({ ...prev, profession: event.target.value }))}
                    />
                  </label>
                  <label>
                    {tr("Type de pièce d’identité")}<input
                      value={parentForm.identityDocumentType}
                      onChange={(event) => setParentForm((prev) => ({ ...prev, identityDocumentType: event.target.value }))}
                    />
                  </label>
                  <label>
                    {tr("Numéro de pièce")}<input
                      value={parentForm.identityDocumentNumber}
                      onChange={(event) => setParentForm((prev) => ({ ...prev, identityDocumentNumber: event.target.value }))}
                    />
                  </label>
                  <label className="span-2">
                    {tr("Notes administratives")}<textarea
                      value={parentForm.notes}
                      onChange={(event) => setParentForm((prev) => ({ ...prev, notes: event.target.value }))}
                      rows={3}
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="students-form-section parents-form-section">
                <legend>{tr("Portail")}</legend>
                <div className="form-grid students-form-grid">
                  <label>
                    {tr("Statut *")}<select
                      required
                      value={parentForm.status}
                      onChange={(event) => setParentForm((prev) => ({ ...prev, status: event.target.value }))}
                    >
                      {PARENT_STATUSES.map((status) => (
                        <option key={status} value={status}>{tr(statusLabel(status))}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {tr("Compte portail optionnel")}<select
                      value={parentForm.userId}
                      onChange={(event) => setParentForm((prev) => ({ ...prev, userId: event.target.value }))}
                    >
                      <option value="">{tr("Aucun compte portail")}</option>
                      {portalParentUsers.map((user) => (
                        <option key={user.id} value={user.id}>{user.username}</option>
                      ))}
                    </select>
                  </label>
                  <p className="form-help span-2">{tr("Le compte portail n’est pas créé automatiquement.")}</p>
                </div>
              </fieldset>

              <div className="actions">
                <button type="submit">{editingParentId ? tr("Enregistrer le responsable") : tr("Créer le responsable")}</button>
                <button type="button" className="button-ghost" onClick={resetParentForm}>{tr("Réinitialiser")}</button>
                <button type="button" className="button-ghost" onClick={() => setActiveStep("list")}>{tr("Voir la liste")}</button>
              </div>
            </form>
          </section>
        ) : null}

        {activeStep === "links" ? (
          <section className="panel table-panel workflow-section module-modern">
            <div className="table-header">
              <div>
                <p className="section-kicker">{tr("Relation parent-élève")}</p>
                <h2>{tr("Liens parent-élève")}</h2>
              </div>
              <span className="students-overview-status">
                {relations.length === 1 ? "1 lien" : `${relations.length} liens`}
              </span>
            </div>
            <form className="form-grid module-form students-form-grid parents-links-form" onSubmit={(event) => void submitLink(event)}>
              <label>
                {tr("Parent *")}<select
                  required
                  value={linkForm.parentId}
                  onChange={(event) => setLinkForm((prev) => ({ ...prev, parentId: event.target.value }))}
                >
                  <option value="">{tr("Choisir")}</option>
                  {parents.filter((parent) => parent.status === "ACTIVE").map((parent) => (
                    <option key={parent.id} value={parent.id}>{parent.fullName} - {tr(roleLabel(parent.parentalRole))}</option>
                  ))}
                </select>
              </label>
              <label>
                {tr("Élève *")}<select
                  required
                  value={linkForm.studentId}
                  onChange={(event) => setLinkForm((prev) => ({ ...prev, studentId: event.target.value }))}
                >
                  <option value="">{tr("Choisir")}</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{buildStudentOption(student)}</option>
                  ))}
                </select>
              </label>
              <label>
                {tr("Relation *")}<select
                  required
                  value={linkForm.relationType}
                  onChange={(event) => setLinkForm((prev) => ({ ...prev, relationType: event.target.value }))}
                >
                  {PARENT_RELATIONS.map((role) => (
                    <option key={role} value={role}>{tr(roleLabel(role))}</option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                {tr("Commentaire")}<input value={linkForm.comment} onChange={(event) => setLinkForm((prev) => ({ ...prev, comment: event.target.value }))} />
              </label>
              <label className="check-row"><input type="checkbox" checked={linkForm.isPrimaryContact} onChange={(event) => setLinkForm((prev) => ({ ...prev, isPrimaryContact: event.target.checked }))} /> {tr("Contact principal")}</label>
              <label className="check-row"><input type="checkbox" checked={linkForm.legalGuardian} onChange={(event) => setLinkForm((prev) => ({ ...prev, legalGuardian: event.target.checked }))} /> {tr("Tuteur légal")}</label>
              <label className="check-row"><input type="checkbox" checked={linkForm.financialResponsible} onChange={(event) => setLinkForm((prev) => ({ ...prev, financialResponsible: event.target.checked }))} /> {tr("Responsable financier")}</label>
              <label className="check-row"><input type="checkbox" checked={linkForm.emergencyContact} onChange={(event) => setLinkForm((prev) => ({ ...prev, emergencyContact: event.target.checked }))} /> {tr("Contact d’urgence")}</label>
              <label className="check-row"><input type="checkbox" checked={linkForm.pickupAuthorized} onChange={(event) => setLinkForm((prev) => ({ ...prev, pickupAuthorized: event.target.checked }))} /> {tr("Autorisé à récupérer l’élève")}</label>
              <label className="check-row"><input type="checkbox" checked={linkForm.livesWithStudent} onChange={(event) => setLinkForm((prev) => ({ ...prev, livesWithStudent: event.target.checked }))} /> {tr("Vit avec l’élève")}</label>
              <div className="actions span-2">
                <button type="submit">{tr("Créer le lien parent-élève")}</button>
              </div>
            </form>

            <div className="table-wrap">
              <table data-responsive-table="true">
                <thead>
                  <tr>
                    <th>{tr("Responsable")}</th>
                    <th>{tr("Élève")}</th>
                    <th>{tr("Relation")}</th>
                    <th>{tr("Cursus élève")}</th>
                    <th>{tr("Rôles")}</th>
                    <th>{tr("Statut")}</th>
                    <th>{tr("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {relations.length === 0 ? (
                    <tr><td colSpan={7} className="empty-row">{tr("Aucun lien parent-élève enregistré.")}</td></tr>
                  ) : (
                    relations.map((relation) => (
                      <tr key={relation.id}>
                        <td data-label={tr("Responsable")}>{relation.parentName || relation.parentUsername || "-"}</td>
                        <td data-label={tr("Élève")}>{relation.studentMatricule} - {relation.studentName}</td>
                        <td data-label={tr("Relation")}>{tr(roleLabel(relation.relationType))}</td>
                        <td data-label={tr("Cursus élève")}>
                          {formatStudentTracks(relation)}
                        </td>
                        <td data-label={tr("Rôles")}>
                          {formatRelationRoles(relation)}
                        </td>
                        <td data-label={tr("Statut")}>
                          <span className={statusPillClassName(relation.status)}>{tr(statusLabel(relation.status))}</span>
                        </td>
                        <td data-label={tr("Actions")}>
                          <button type="button" className="button-danger" onClick={() => void archiveLink(relation.id)}>
                            {tr("Archiver")}</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </WorkflowGuide>
  );
}
