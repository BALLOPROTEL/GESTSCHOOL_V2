import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type {
  ParentRecord,
  ParentStudentRelation,
  Student,
  UserAccount,
  WorkflowStepDef
} from "../app-types";
import { WorkflowGuide } from "../components/workflow-guide";

type ParentsScreenProps = {
  api: (path: string, init?: RequestInit) => Promise<Response>;
  students: Student[];
  users: UserAccount[];
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onParentsChanged?: () => Promise<void> | void;
};

type ParentForm = {
  parentalRole: string;
  firstName: string;
  lastName: string;
  sex: "" | "M" | "F";
  primaryPhone: string;
  secondaryPhone: string;
  email: string;
  address: string;
  profession: string;
  identityDocumentType: string;
  identityDocumentNumber: string;
  status: string;
  establishmentId: string;
  userId: string;
  notes: string;
};

type LinkForm = {
  parentId: string;
  studentId: string;
  relationType: string;
  isPrimaryContact: boolean;
  livesWithStudent: boolean;
  pickupAuthorized: boolean;
  legalGuardian: boolean;
  financialResponsible: boolean;
  emergencyContact: boolean;
  comment: string;
};

const SCHOOL_NAME = "Al Manarat Islamiyat";
const PARENT_ROLES = ["PERE", "MERE", "TUTEUR", "AUTRE"];
const PARENT_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"];

const roleLabel = (role?: string): string => {
  if (role === "PERE") return "Pere";
  if (role === "MERE") return "Mere";
  if (role === "TUTEUR") return "Tuteur";
  return "Autre";
};

const trackLabel = (track?: string): string => (track === "ARABOPHONE" ? "Arabophone" : "Francophone");

const defaultParentForm = (): ParentForm => ({
  parentalRole: "PERE",
  firstName: "",
  lastName: "",
  sex: "",
  primaryPhone: "",
  secondaryPhone: "",
  email: "",
  address: "",
  profession: "",
  identityDocumentType: "",
  identityDocumentNumber: "",
  status: "ACTIVE",
  establishmentId: "",
  userId: "",
  notes: ""
});

const defaultLinkForm = (): LinkForm => ({
  parentId: "",
  studentId: "",
  relationType: "PERE",
  isPrimaryContact: false,
  livesWithStudent: false,
  pickupAuthorized: false,
  legalGuardian: false,
  financialResponsible: false,
  emergencyContact: false,
  comment: ""
});

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    if (payload.message) return payload.message;
    if (payload.error) return payload.error;
  } catch {
    // Ignore malformed error payloads.
  }
  return `Erreur HTTP ${response.status}`;
}

const buildStudentOption = (student: Student): string =>
  `${student.matricule} - ${student.fullName || `${student.firstName} ${student.lastName}`}`;

export function ParentsScreen({
  api,
  onError,
  onNotice,
  onParentsChanged,
  students,
  users
}: ParentsScreenProps): JSX.Element {
  const [activeStep, setActiveStep] = useState("list");
  const [parents, setParents] = useState<ParentRecord[]>([]);
  const [relations, setRelations] = useState<ParentStudentRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedParentId, setSelectedParentId] = useState("");
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [parentForm, setParentForm] = useState<ParentForm>(defaultParentForm);
  const [linkForm, setLinkForm] = useState<LinkForm>(defaultLinkForm);

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
    setLoading(true);
    const [parentsResponse, linksResponse] = await Promise.all([
      api("/parents"),
      api("/parents/links")
    ]);
    setLoading(false);

    if (!parentsResponse.ok) {
      onError(await parseError(parentsResponse));
      return;
    }
    if (!linksResponse.ok) {
      onError(await parseError(linksResponse));
      return;
    }

    setParents((await parentsResponse.json()) as ParentRecord[]);
    setRelations((await linksResponse.json()) as ParentStudentRelation[]);
  }, [api, onError]);

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
    if (!parentForm.firstName.trim() || !parentForm.lastName.trim() || !parentForm.primaryPhone.trim()) {
      onError("Nom, prenom et telephone principal sont requis pour creer un parent.");
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

    const response = await api(editingParentId ? `/parents/${editingParentId}` : "/parents", {
      method: editingParentId ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      onError(await parseError(response));
      return;
    }

    resetParentForm();
    onNotice(editingParentId ? "Parent modifie." : "Parent cree.");
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
    if (!window.confirm("Archiver ce parent ?")) return;
    const response = await api(`/parents/${parentId}`, { method: "DELETE" });
    if (!response.ok) {
      onError(await parseError(response));
      return;
    }
    onNotice("Parent archive.");
    if (selectedParentId === parentId) setSelectedParentId("");
    await loadData();
    await onParentsChanged?.();
  };

  const submitLink = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!linkForm.parentId || !linkForm.studentId) {
      onError("Parent et eleve sont requis pour creer le lien.");
      return;
    }

    const response = await api("/parents/links", {
      method: "POST",
      body: JSON.stringify({
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
      })
    });
    if (!response.ok) {
      onError(await parseError(response));
      return;
    }

    setLinkForm((previous) => ({
      ...defaultLinkForm(),
      parentId: previous.parentId,
      studentId: previous.studentId
    }));
    onNotice("Lien parent-eleve cree.");
    await loadData();
    await onParentsChanged?.();
  };

  const archiveLink = async (linkId: string): Promise<void> => {
    const response = await api(`/parents/links/${linkId}`, { method: "DELETE" });
    if (!response.ok) {
      onError(await parseError(response));
      return;
    }
    onNotice("Lien parent-eleve archive.");
    await loadData();
    await onParentsChanged?.();
  };

  const steps: WorkflowStepDef[] = [
    { id: "list", title: "Liste parents", hint: "Identifier les responsables metier.", done: parents.length > 0 },
    { id: "entry", title: editingParentId ? "Edition parent" : "Ajouter parent", hint: "Creer une fiche Parent distincte du compte portail." },
    { id: "links", title: "Liens parent-eleve", hint: "Declarer les responsables par enfant.", done: relations.length > 0 }
  ];

  return (
    <WorkflowGuide title="Parents" steps={steps} activeStepId={activeStep} onStepChange={setActiveStep}>
      <div className="students-screen-shell">
        {activeStep === "list" ? (
          <>
            <section className="panel table-panel workflow-section module-modern">
              <div className="table-header">
                <div>
                  <p className="section-kicker">Responsables</p>
                  <h2>Liste parents</h2>
                </div>
                <div className="students-table-toolbar">
                  <label className="students-search-field">
                    <span>Recherche rapide</span>
                    <input
                      className="search-input"
                      placeholder="Nom, telephone, email"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                </div>
              </div>
              <p className="section-lead">
                Un parent est une personne metier. Le compte portail reste un rattachement optionnel.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Parent</th>
                      <th>Role</th>
                      <th>Telephone</th>
                      <th>Email</th>
                      <th>Enfants</th>
                      <th>Portail</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} className="empty-row">Chargement...</td></tr>
                    ) : shownParents.length === 0 ? (
                      <tr><td colSpan={8} className="empty-row">Aucun parent.</td></tr>
                    ) : (
                      shownParents.map((parent) => (
                        <tr key={parent.id}>
                          <td>{parent.fullName}</td>
                          <td>{roleLabel(parent.parentalRole)}</td>
                          <td>{parent.primaryPhone}</td>
                          <td>{parent.email || "-"}</td>
                          <td>{parent.childrenCount}</td>
                          <td>{parent.userUsername || "Non lie"}</td>
                          <td>{parent.status}</td>
                          <td>
                            <div className="row-actions">
                              <button type="button" className="button-ghost" onClick={() => setSelectedParentId(parent.id)}>
                                Detail
                              </button>
                              <button type="button" className="button-ghost" onClick={() => editParent(parent)}>
                                Modifier
                              </button>
                              <button type="button" className="button-danger" onClick={() => void archiveParent(parent.id)}>
                                Archiver
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {selectedParent ? (
              <section className="panel table-panel workflow-section module-modern">
                <div className="table-header">
                  <div>
                    <p className="section-kicker">Detail parent</p>
                    <h2>{selectedParent.fullName}</h2>
                  </div>
                  <span className="students-overview-status">{selectedParent.status}</span>
                </div>
                <div className="students-overview-grid">
                  <article className="students-overview-card">
                    <span>Role</span>
                    <strong>{roleLabel(selectedParent.parentalRole)}</strong>
                    <small>{selectedParent.userUsername ? "Compte portail lie" : "Sans compte portail"}</small>
                  </article>
                  <article className="students-overview-card">
                    <span>Contact</span>
                    <strong>{selectedParent.primaryPhone}</strong>
                    <small>{selectedParent.email || "Email non renseigne"}</small>
                  </article>
                  <article className="students-overview-card">
                    <span>Enfants lies</span>
                    <strong>{selectedParent.childrenCount}</strong>
                    <small>{selectedParent.primaryChildrenCount} contact principal</small>
                  </article>
                  <article className="students-overview-card">
                    <span>Etablissement</span>
                    <strong>{SCHOOL_NAME}</strong>
                    <small>{selectedParent.profession || "Profession non renseignee"}</small>
                  </article>
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {activeStep === "entry" ? (
          <section className="panel editor-panel workflow-section module-modern">
            <div className="table-header">
              <div>
                <p className="section-kicker">Fiche parent</p>
                <h2>{editingParentId ? "Modifier parent" : "Ajouter parent"}</h2>
              </div>
              <span className="students-overview-status">Metier, pas IAM</span>
            </div>
            <form className="form-grid module-form students-form-grid" onSubmit={(event) => void submitParent(event)}>
              <label>
                Role parental
                <select
                  value={parentForm.parentalRole}
                  onChange={(event) => setParentForm((prev) => ({ ...prev, parentalRole: event.target.value }))}
                >
                  {PARENT_ROLES.map((role) => (
                    <option key={role} value={role}>{roleLabel(role)}</option>
                  ))}
                </select>
              </label>
              <label>
                Prenom
                <input value={parentForm.firstName} onChange={(event) => setParentForm((prev) => ({ ...prev, firstName: event.target.value }))} required />
              </label>
              <label>
                Nom
                <input value={parentForm.lastName} onChange={(event) => setParentForm((prev) => ({ ...prev, lastName: event.target.value }))} required />
              </label>
              <label>
                Sexe
                <select value={parentForm.sex} onChange={(event) => setParentForm((prev) => ({ ...prev, sex: event.target.value as "" | "M" | "F" }))}>
                  <option value="">Non renseigne</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </label>
              <label>
                Telephone principal
                <input value={parentForm.primaryPhone} onChange={(event) => setParentForm((prev) => ({ ...prev, primaryPhone: event.target.value }))} required />
              </label>
              <label>
                Telephone secondaire
                <input value={parentForm.secondaryPhone} onChange={(event) => setParentForm((prev) => ({ ...prev, secondaryPhone: event.target.value }))} />
              </label>
              <label>
                Email
                <input type="email" value={parentForm.email} onChange={(event) => setParentForm((prev) => ({ ...prev, email: event.target.value }))} />
              </label>
              <label>
                Profession
                <input value={parentForm.profession} onChange={(event) => setParentForm((prev) => ({ ...prev, profession: event.target.value }))} />
              </label>
              <label>
                Piece identite
                <input value={parentForm.identityDocumentType} onChange={(event) => setParentForm((prev) => ({ ...prev, identityDocumentType: event.target.value }))} />
              </label>
              <label>
                Numero piece
                <input value={parentForm.identityDocumentNumber} onChange={(event) => setParentForm((prev) => ({ ...prev, identityDocumentNumber: event.target.value }))} />
              </label>
              <label>
                Statut
                <select value={parentForm.status} onChange={(event) => setParentForm((prev) => ({ ...prev, status: event.target.value }))}>
                  {PARENT_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                Compte portail optionnel
                <select value={parentForm.userId} onChange={(event) => setParentForm((prev) => ({ ...prev, userId: event.target.value }))}>
                  <option value="">Aucun compte portail</option>
                  {portalParentUsers.map((user) => (
                    <option key={user.id} value={user.id}>{user.username}</option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                Adresse
                <input value={parentForm.address} onChange={(event) => setParentForm((prev) => ({ ...prev, address: event.target.value }))} />
              </label>
              <label className="span-2">
                Notes
                <textarea value={parentForm.notes} onChange={(event) => setParentForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} />
              </label>
              <div className="actions span-2">
                <button type="submit">{editingParentId ? "Mettre a jour" : "Creer parent"}</button>
                <button type="button" className="button-ghost" onClick={resetParentForm}>Reinitialiser</button>
                <button type="button" className="button-ghost" onClick={() => setActiveStep("list")}>Retour liste</button>
              </div>
            </form>
          </section>
        ) : null}

        {activeStep === "links" ? (
          <section className="panel table-panel workflow-section module-modern">
            <div className="table-header">
              <div>
                <p className="section-kicker">Relation parent-enfant</p>
                <h2>Liens parent-eleve</h2>
              </div>
              <span className="students-overview-status">{relations.length} lien(s)</span>
            </div>
            <form className="form-grid module-form students-form-grid" onSubmit={(event) => void submitLink(event)}>
              <label>
                Parent
                <select value={linkForm.parentId} onChange={(event) => setLinkForm((prev) => ({ ...prev, parentId: event.target.value }))}>
                  <option value="">Choisir</option>
                  {parents.filter((parent) => parent.status === "ACTIVE").map((parent) => (
                    <option key={parent.id} value={parent.id}>{parent.fullName} - {roleLabel(parent.parentalRole)}</option>
                  ))}
                </select>
              </label>
              <label>
                Eleve
                <select value={linkForm.studentId} onChange={(event) => setLinkForm((prev) => ({ ...prev, studentId: event.target.value }))}>
                  <option value="">Choisir</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{buildStudentOption(student)}</option>
                  ))}
                </select>
              </label>
              <label>
                Relation
                <select value={linkForm.relationType} onChange={(event) => setLinkForm((prev) => ({ ...prev, relationType: event.target.value }))}>
                  {PARENT_ROLES.map((role) => (
                    <option key={role} value={role}>{roleLabel(role)}</option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                Commentaire
                <input value={linkForm.comment} onChange={(event) => setLinkForm((prev) => ({ ...prev, comment: event.target.value }))} />
              </label>
              <label className="check-row"><input type="checkbox" checked={linkForm.isPrimaryContact} onChange={(event) => setLinkForm((prev) => ({ ...prev, isPrimaryContact: event.target.checked }))} /> Contact principal</label>
              <label className="check-row"><input type="checkbox" checked={linkForm.legalGuardian} onChange={(event) => setLinkForm((prev) => ({ ...prev, legalGuardian: event.target.checked }))} /> Tuteur legal</label>
              <label className="check-row"><input type="checkbox" checked={linkForm.financialResponsible} onChange={(event) => setLinkForm((prev) => ({ ...prev, financialResponsible: event.target.checked }))} /> Responsable financier</label>
              <label className="check-row"><input type="checkbox" checked={linkForm.emergencyContact} onChange={(event) => setLinkForm((prev) => ({ ...prev, emergencyContact: event.target.checked }))} /> Contact urgence</label>
              <label className="check-row"><input type="checkbox" checked={linkForm.pickupAuthorized} onChange={(event) => setLinkForm((prev) => ({ ...prev, pickupAuthorized: event.target.checked }))} /> Autorise recuperation</label>
              <label className="check-row"><input type="checkbox" checked={linkForm.livesWithStudent} onChange={(event) => setLinkForm((prev) => ({ ...prev, livesWithStudent: event.target.checked }))} /> Vit avec l'eleve</label>
              <div className="actions span-2">
                <button type="submit">Creer lien parent-eleve</button>
              </div>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Parent</th>
                    <th>Eleve</th>
                    <th>Relation</th>
                    <th>Cursus eleve</th>
                    <th>Roles</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {relations.length === 0 ? (
                    <tr><td colSpan={7} className="empty-row">Aucun lien parent-eleve.</td></tr>
                  ) : (
                    relations.map((relation) => (
                      <tr key={relation.id}>
                        <td>{relation.parentName || relation.parentUsername || "-"}</td>
                        <td>{relation.studentMatricule} - {relation.studentName}</td>
                        <td>{roleLabel(relation.relationType)}</td>
                        <td>
                          {relation.studentTracks.length > 0
                            ? relation.studentTracks.map(trackLabel).join(" + ")
                            : "A regulariser"}
                        </td>
                        <td>
                          {[
                            relation.isPrimaryContact ? "principal" : "",
                            relation.legalGuardian ? "legal" : "",
                            relation.financialResponsible ? "finance" : "",
                            relation.emergencyContact ? "urgence" : ""
                          ].filter(Boolean).join(", ") || "-"}
                        </td>
                        <td>{relation.status}</td>
                        <td>
                          <button type="button" className="button-danger" onClick={() => void archiveLink(relation.id)}>
                            Archiver
                          </button>
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
