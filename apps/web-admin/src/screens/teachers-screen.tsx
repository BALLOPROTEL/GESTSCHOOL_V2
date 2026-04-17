import { type FormEvent, useEffect, useMemo, useState } from "react";

import type {
  AcademicTrack,
  ClassItem,
  Cycle,
  Level,
  Period,
  SchoolYear,
  Subject,
  TeacherDetailRecord,
  TeacherDocumentRecord,
  TeacherPedagogicalAssignment,
  TeacherRecord,
  TeacherSkillRecord,
  TeacherWorkloadRecord,
  UserAccount,
  WorkflowStepDef
} from "../app-types";
import { WorkflowGuide } from "../components/workflow-guide";

type TeachersScreenProps = {
  api: (path: string, init?: RequestInit) => Promise<Response>;
  classes: ClassItem[];
  cycles: Cycle[];
  levels: Level[];
  periods: Period[];
  schoolYears: SchoolYear[];
  subjects: Subject[];
  users: UserAccount[];
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

type TeacherForm = {
  matricule: string;
  firstName: string;
  lastName: string;
  sex: "" | "M" | "F";
  birthDate: string;
  primaryPhone: string;
  secondaryPhone: string;
  email: string;
  address: string;
  nationality: string;
  identityDocumentType: string;
  identityDocumentNumber: string;
  hireDate: string;
  teacherType: string;
  speciality: string;
  mainDiploma: string;
  teachingLanguage: string;
  status: string;
  establishmentId: string;
  userId: string;
  internalNotes: string;
};

type SkillForm = {
  teacherId: string;
  subjectId: string;
  track: AcademicTrack;
  cycleId: string;
  levelId: string;
  qualification: string;
  yearsExperience: string;
  priority: string;
  status: string;
  comment: string;
};

type AssignmentForm = {
  teacherId: string;
  schoolYearId: string;
  classId: string;
  subjectId: string;
  track: AcademicTrack;
  periodId: string;
  workloadHours: string;
  coefficient: string;
  isHomeroomTeacher: boolean;
  role: string;
  startDate: string;
  endDate: string;
  status: string;
  comment: string;
};

type DocumentForm = {
  teacherId: string;
  documentType: string;
  fileUrl: string;
  originalName: string;
  mimeType: string;
  size: string;
  status: string;
};

const SCHOOL_NAME = "Al Manarat Islamiyat";
const TEACHER_TYPES = ["TITULAIRE", "VACATAIRE", "CONTRACTUEL", "STAGIAIRE"];
const TEACHER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"];
const ASSIGNMENT_STATUSES = ["ACTIVE", "INACTIVE", "COMPLETED", "SUSPENDED", "ARCHIVED"];
const DOCUMENT_TYPES = ["CONTRAT", "DIPLOME", "PIECE_IDENTITE", "CV", "ATTESTATION", "AUTRE"];
const TRACKS: AcademicTrack[] = ["FRANCOPHONE", "ARABOPHONE"];
const trackLabel = (track: AcademicTrack): string => (track === "ARABOPHONE" ? "Arabophone" : "Francophone");

const today = (): string => new Date().toISOString().slice(0, 10);
const emptyToUndefined = (value: string): string | undefined => {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
};
const numberOrUndefined = (value: string): number | undefined => {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const defaultTeacherForm = (): TeacherForm => ({
  matricule: "",
  firstName: "",
  lastName: "",
  sex: "",
  birthDate: "",
  primaryPhone: "",
  secondaryPhone: "",
  email: "",
  address: "",
  nationality: "",
  identityDocumentType: "",
  identityDocumentNumber: "",
  hireDate: "",
  teacherType: "TITULAIRE",
  speciality: "",
  mainDiploma: "",
  teachingLanguage: "Francais",
  status: "ACTIVE",
  establishmentId: "",
  userId: "",
  internalNotes: ""
});

const defaultSkillForm = (): SkillForm => ({
  teacherId: "",
  subjectId: "",
  track: "FRANCOPHONE",
  cycleId: "",
  levelId: "",
  qualification: "",
  yearsExperience: "",
  priority: "",
  status: "ACTIVE",
  comment: ""
});

const defaultAssignmentForm = (): AssignmentForm => ({
  teacherId: "",
  schoolYearId: "",
  classId: "",
  subjectId: "",
  track: "FRANCOPHONE",
  periodId: "",
  workloadHours: "",
  coefficient: "",
  isHomeroomTeacher: false,
  role: "",
  startDate: today(),
  endDate: "",
  status: "ACTIVE",
  comment: ""
});

const defaultDocumentForm = (): DocumentForm => ({
  teacherId: "",
  documentType: "CONTRAT",
  fileUrl: "",
  originalName: "",
  mimeType: "application/pdf",
  size: "",
  status: "ACTIVE"
});

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    if (payload.message) return payload.message;
    if (payload.error) return payload.error;
  } catch {
    // ignore invalid error payloads
  }
  return `Erreur HTTP ${response.status}`;
}

export function TeachersScreen(props: TeachersScreenProps): JSX.Element {
  const { api, classes, cycles, levels, onError, onNotice, periods, schoolYears, subjects, users } = props;
  const [activeStep, setActiveStep] = useState("list");
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [skills, setSkills] = useState<TeacherSkillRecord[]>([]);
  const [assignments, setAssignments] = useState<TeacherPedagogicalAssignment[]>([]);
  const [documents, setDocuments] = useState<TeacherDocumentRecord[]>([]);
  const [workloads, setWorkloads] = useState<TeacherWorkloadRecord[]>([]);
  const [detail, setDetail] = useState<TeacherDetailRecord | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ search: "", status: "", teacherType: "", subjectId: "", classId: "", track: "" });
  const [teacherForm, setTeacherForm] = useState<TeacherForm>(defaultTeacherForm);
  const [skillForm, setSkillForm] = useState<SkillForm>(defaultSkillForm);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>(defaultAssignmentForm);
  const [documentForm, setDocumentForm] = useState<DocumentForm>(defaultDocumentForm);

  const activeSchoolYear = useMemo(
    () => schoolYears.find((item) => item.isActive) || schoolYears[0],
    [schoolYears]
  );
  const teacherUsers = useMemo(
    () => users.filter((user) => user.role === "ENSEIGNANT" && user.isActive),
    [users]
  );
  const selectedTeacher = teachers.find((teacher) => teacher.id === selectedTeacherId) || teachers[0];

  const steps: WorkflowStepDef[] = [
    { id: "list", title: "Liste des enseignants", hint: "Rechercher, filtrer et ouvrir une fiche.", done: teachers.length > 0 },
    { id: "form", title: editingTeacherId ? "Edition enseignant" : "Ajouter un enseignant", hint: "Identite, contact et statut." },
    { id: "detail", title: "Detail enseignant", hint: "Fiche complete, competences, affectations et documents." },
    { id: "skills", title: "Competences", hint: "Matiere, cycle, niveau et qualification.", done: skills.length > 0 },
    { id: "assignments", title: "Affectations", hint: "Classe, matiere, annee, charge et titulaire.", done: assignments.length > 0 },
    { id: "workloads", title: "Charges", hint: "Synthese des volumes horaires.", done: workloads.length > 0 },
    { id: "documents", title: "Documents", hint: "Contrats, diplomes, pieces et attestations.", done: documents.length > 0 }
  ];

  const loadTeachers = async (): Promise<void> => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const response = await api(`/teachers${query.toString() ? `?${query.toString()}` : ""}`);
    if (!response.ok) throw new Error(await parseError(response));
    const rows = (await response.json()) as TeacherRecord[];
    setTeachers(rows);
    if (!selectedTeacherId && rows[0]) setSelectedTeacherId(rows[0].id);
  };

  const loadModule = async (): Promise<void> => {
    setLoading(true);
    try {
      const [teacherRes, skillRes, assignmentRes, documentRes, workloadRes] = await Promise.all([
        api("/teachers"),
        api("/teachers/skills"),
        api("/teachers/assignments"),
        api("/teachers/documents"),
        api(`/teachers/workloads${activeSchoolYear?.id ? `?schoolYearId=${encodeURIComponent(activeSchoolYear.id)}` : ""}`)
      ]);
      const failed = [teacherRes, skillRes, assignmentRes, documentRes, workloadRes].find((response) => !response.ok);
      if (failed) throw new Error(await parseError(failed));
      const [teacherRows, skillRows, assignmentRows, documentRows, workloadRows] = await Promise.all([
        teacherRes.json() as Promise<TeacherRecord[]>,
        skillRes.json() as Promise<TeacherSkillRecord[]>,
        assignmentRes.json() as Promise<TeacherPedagogicalAssignment[]>,
        documentRes.json() as Promise<TeacherDocumentRecord[]>,
        workloadRes.json() as Promise<TeacherWorkloadRecord[]>
      ]);
      setTeachers(teacherRows);
      setSkills(skillRows);
      setAssignments(assignmentRows);
      setDocuments(documentRows);
      setWorkloads(workloadRows);
      if (!selectedTeacherId && teacherRows[0]) setSelectedTeacherId(teacherRows[0].id);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Impossible de charger le module enseignants.");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (teacherId: string): Promise<void> => {
    if (!teacherId) return;
    const response = await api(`/teachers/${teacherId}`);
    if (!response.ok) {
      onError(await parseError(response));
      return;
    }
    setDetail((await response.json()) as TeacherDetailRecord);
  };

  useEffect(() => {
    void loadModule();
  }, []);

  useEffect(() => {
    if (activeSchoolYear?.id && !assignmentForm.schoolYearId) {
      setAssignmentForm((prev) => ({ ...prev, schoolYearId: activeSchoolYear.id, startDate: activeSchoolYear.startDate || today() }));
    }
  }, [activeSchoolYear?.id]);

  useEffect(() => {
    const teacherId = selectedTeacherId || teachers[0]?.id || "";
    if (!teacherId) return;
    setSkillForm((prev) => (prev.teacherId ? prev : { ...prev, teacherId }));
    setAssignmentForm((prev) => (prev.teacherId ? prev : { ...prev, teacherId }));
    setDocumentForm((prev) => (prev.teacherId ? prev : { ...prev, teacherId }));
    if (activeStep === "detail") void loadDetail(teacherId);
  }, [activeStep, selectedTeacherId, teachers]);

  const submitTeacher = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const payload = {
      ...teacherForm,
      sex: teacherForm.sex || undefined,
      birthDate: emptyToUndefined(teacherForm.birthDate),
      hireDate: emptyToUndefined(teacherForm.hireDate),
      primaryPhone: emptyToUndefined(teacherForm.primaryPhone),
      secondaryPhone: emptyToUndefined(teacherForm.secondaryPhone),
      email: emptyToUndefined(teacherForm.email),
      address: emptyToUndefined(teacherForm.address),
      nationality: emptyToUndefined(teacherForm.nationality),
      identityDocumentType: emptyToUndefined(teacherForm.identityDocumentType),
      identityDocumentNumber: emptyToUndefined(teacherForm.identityDocumentNumber),
      speciality: emptyToUndefined(teacherForm.speciality),
      mainDiploma: emptyToUndefined(teacherForm.mainDiploma),
      teachingLanguage: emptyToUndefined(teacherForm.teachingLanguage),
      establishmentId: emptyToUndefined(teacherForm.establishmentId),
      userId: emptyToUndefined(teacherForm.userId),
      internalNotes: emptyToUndefined(teacherForm.internalNotes)
    };
    const response = await api(editingTeacherId ? `/teachers/${editingTeacherId}` : "/teachers", {
      method: editingTeacherId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      onError(await parseError(response));
      return;
    }
    const saved = (await response.json()) as TeacherRecord;
    setSelectedTeacherId(saved.id);
    setEditingTeacherId(null);
    setTeacherForm(defaultTeacherForm());
    onNotice("Fiche enseignant enregistree.");
    await loadModule();
    setActiveStep("detail");
  };

  const submitSkill = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const response = await api("/teachers/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacherId: skillForm.teacherId,
        subjectId: skillForm.subjectId,
        track: skillForm.track,
        cycleId: emptyToUndefined(skillForm.cycleId),
        levelId: emptyToUndefined(skillForm.levelId),
        qualification: emptyToUndefined(skillForm.qualification),
        yearsExperience: numberOrUndefined(skillForm.yearsExperience),
        priority: numberOrUndefined(skillForm.priority),
        status: skillForm.status,
        comment: emptyToUndefined(skillForm.comment)
      })
    });
    if (!response.ok) return onError(await parseError(response));
    onNotice("Competence enseignant ajoutee.");
    setSkillForm((prev) => ({ ...defaultSkillForm(), teacherId: prev.teacherId }));
    await loadModule();
  };

  const submitAssignment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const response = await api("/teachers/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacherId: assignmentForm.teacherId,
        schoolYearId: assignmentForm.schoolYearId,
        classId: assignmentForm.classId,
        subjectId: assignmentForm.subjectId,
        track: assignmentForm.track,
        periodId: emptyToUndefined(assignmentForm.periodId),
        workloadHours: numberOrUndefined(assignmentForm.workloadHours),
        coefficient: numberOrUndefined(assignmentForm.coefficient),
        isHomeroomTeacher: assignmentForm.isHomeroomTeacher,
        role: emptyToUndefined(assignmentForm.role),
        startDate: assignmentForm.startDate,
        endDate: emptyToUndefined(assignmentForm.endDate),
        status: assignmentForm.status,
        comment: emptyToUndefined(assignmentForm.comment)
      })
    });
    if (!response.ok) return onError(await parseError(response));
    onNotice("Affectation pedagogique creee.");
    setAssignmentForm((prev) => ({ ...defaultAssignmentForm(), teacherId: prev.teacherId, schoolYearId: prev.schoolYearId }));
    await loadModule();
  };

  const submitDocument = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const response = await api("/teachers/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacherId: documentForm.teacherId,
        documentType: documentForm.documentType,
        fileUrl: documentForm.fileUrl,
        originalName: documentForm.originalName,
        mimeType: emptyToUndefined(documentForm.mimeType),
        size: numberOrUndefined(documentForm.size),
        status: documentForm.status
      })
    });
    if (!response.ok) return onError(await parseError(response));
    onNotice("Document enseignant reference.");
    setDocumentForm((prev) => ({ ...defaultDocumentForm(), teacherId: prev.teacherId }));
    await loadModule();
  };

  const editTeacher = (teacher: TeacherRecord): void => {
    setEditingTeacherId(teacher.id);
    setTeacherForm({
      matricule: teacher.matricule,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      sex: teacher.sex || "",
      birthDate: teacher.birthDate || "",
      primaryPhone: teacher.primaryPhone || "",
      secondaryPhone: teacher.secondaryPhone || "",
      email: teacher.email || "",
      address: teacher.address || "",
      nationality: teacher.nationality || "",
      identityDocumentType: teacher.identityDocumentType || "",
      identityDocumentNumber: teacher.identityDocumentNumber || "",
      hireDate: teacher.hireDate || "",
      teacherType: teacher.teacherType,
      speciality: teacher.speciality || "",
      mainDiploma: teacher.mainDiploma || "",
      teachingLanguage: teacher.teachingLanguage || "",
      status: teacher.status,
      establishmentId: teacher.establishmentId || "",
      userId: teacher.userId || "",
      internalNotes: teacher.internalNotes || ""
    });
    setActiveStep("form");
  };

  const archiveResource = async (path: string, successMessage: string): Promise<void> => {
    const response = await api(path, { method: "DELETE" });
    if (!response.ok) return onError(await parseError(response));
    onNotice(successMessage);
    await loadModule();
  };

  const openDetail = (teacherId: string): void => {
    setSelectedTeacherId(teacherId);
    setActiveStep("detail");
    void loadDetail(teacherId);
  };

  const filteredClasses = classes.filter(
    (item) => !assignmentForm.schoolYearId || item.schoolYearId === assignmentForm.schoolYearId
  );
  const filteredPeriods = periods.filter(
    (item) => !assignmentForm.schoolYearId || item.schoolYearId === assignmentForm.schoolYearId
  );
  const selectedTeacherAssignments = selectedTeacherId
    ? assignments.filter((item) => item.teacherId === selectedTeacherId)
    : assignments;
  const selectedTeacherSkills = selectedTeacherId ? skills.filter((item) => item.teacherId === selectedTeacherId) : skills;
  const selectedTeacherDocuments = selectedTeacherId
    ? documents.filter((item) => item.teacherId === selectedTeacherId)
    : documents;

  return (
    <WorkflowGuide title="Enseignants" steps={steps} activeStepId={activeStep} onStepChange={setActiveStep}>
      {activeStep === "list" ? (
        <section className="panel table-panel workflow-section module-modern teachers-hero">
          <div className="table-header">
            <div>
              <p className="section-kicker">Gestion pedagogique</p>
              <h2>Module enseignants</h2>
            </div>
            <span className="module-header-badge">{loading ? "Synchronisation..." : `${teachers.length} enseignant(s)`}</span>
          </div>
          <p className="section-lead">
            Fiche enseignant, competences, affectations reelles, charge de travail et documents. L'ancien lien
            portail reste dans IAM, mais la verite metier vit ici.
          </p>
          <div className="module-overview-grid">
            <article className="module-overview-card">
              <span>Actifs</span>
              <strong>{teachers.filter((item) => item.status === "ACTIVE").length}</strong>
              <small>Enseignants affectables</small>
            </article>
            <article className="module-overview-card">
              <span>Competences</span>
              <strong>{skills.length}</strong>
              <small>Matiere et perimetre autorises</small>
            </article>
            <article className="module-overview-card">
              <span>Affectations</span>
              <strong>{assignments.filter((item) => item.status === "ACTIVE").length}</strong>
              <small>Classe + matiere + annee</small>
            </article>
            <article className="module-overview-card">
              <span>Charge hebdo</span>
              <strong>{workloads.reduce((sum, item) => sum + item.workloadHoursTotal, 0)}</strong>
              <small>Heures declarees</small>
            </article>
          </div>
        </section>
      ) : null}

      {activeStep === "list" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header">
            <div>
              <p className="section-kicker">Registre enseignants</p>
              <h2>Liste enseignants</h2>
            </div>
            <button type="button" onClick={() => setActiveStep("form")}>Ajouter un enseignant</button>
          </div>
          <div className="filter-grid module-filter teachers-filter-grid">
            <label>
              Recherche
              <input value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} placeholder="Nom, prenom, matricule, email" />
            </label>
            <label>
              Statut
              <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                <option value="">Tous</option>
                {TEACHER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label>
              Type
              <select value={filters.teacherType} onChange={(event) => setFilters((prev) => ({ ...prev, teacherType: event.target.value }))}>
                <option value="">Tous</option>
                {TEACHER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label>
              Matiere
              <select value={filters.subjectId} onChange={(event) => setFilters((prev) => ({ ...prev, subjectId: event.target.value }))}>
                <option value="">Toutes</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}
              </select>
            </label>
            <label>
              Cursus
              <select value={filters.track} onChange={(event) => setFilters((prev) => ({ ...prev, track: event.target.value }))}>
                <option value="">Tous</option>
                {TRACKS.map((track) => <option key={track} value={track}>{trackLabel(track)}</option>)}
              </select>
            </label>
            <div className="actions">
              <button type="button" onClick={() => void loadTeachers()}>Filtrer</button>
              <button type="button" className="button-ghost" onClick={() => { setFilters({ search: "", status: "", teacherType: "", subjectId: "", classId: "", track: "" }); void loadModule(); }}>Reinitialiser</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Nom complet</th>
                  <th>Telephone</th>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Etablissement</th>
                  <th>Statut</th>
                  <th>Affect.</th>
                  <th>Charge</th>
                  <th>FR/AR</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr><td colSpan={11} className="empty-row">{loading ? "Chargement..." : "Aucun enseignant."}</td></tr>
                ) : teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>{teacher.matricule}</td>
                    <td>{teacher.fullName}</td>
                    <td>{teacher.primaryPhone || "-"}</td>
                    <td>{teacher.email || "-"}</td>
                    <td>{teacher.teacherType}</td>
                    <td>{SCHOOL_NAME}</td>
                    <td><span className="status-pill">{teacher.status}</span></td>
                    <td>{teacher.activeAssignmentsCount}</td>
                    <td>{teacher.workloadHoursTotal} h</td>
                    <td>{teacher.francophoneWorkloadHoursTotal} h / {teacher.arabophoneWorkloadHoursTotal} h</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="button-ghost" onClick={() => openDetail(teacher.id)}>Detail</button>
                        <button type="button" className="button-ghost" onClick={() => editTeacher(teacher)}>Modifier</button>
                        <button type="button" className="button-ghost" onClick={() => void archiveResource(`/teachers/${teacher.id}`, "Enseignant archive.")}>Archiver</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeStep === "form" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header">
            <div>
              <p className="section-kicker">Fiche enseignant</p>
              <h2>{editingTeacherId ? "Modifier enseignant" : "Ajouter un enseignant"}</h2>
            </div>
            <span className="module-header-badge">{SCHOOL_NAME}</span>
          </div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitTeacher}>
            <label>Matricule<input value={teacherForm.matricule} onChange={(event) => setTeacherForm((prev) => ({ ...prev, matricule: event.target.value }))} required /></label>
            <label>Prenom<input value={teacherForm.firstName} onChange={(event) => setTeacherForm((prev) => ({ ...prev, firstName: event.target.value }))} required /></label>
            <label>Nom<input value={teacherForm.lastName} onChange={(event) => setTeacherForm((prev) => ({ ...prev, lastName: event.target.value }))} required /></label>
            <label>Sexe<select value={teacherForm.sex} onChange={(event) => setTeacherForm((prev) => ({ ...prev, sex: event.target.value as TeacherForm["sex"] }))}><option value="">Choisir</option><option value="M">M</option><option value="F">F</option></select></label>
            <label>Date naissance<input type="date" value={teacherForm.birthDate} onChange={(event) => setTeacherForm((prev) => ({ ...prev, birthDate: event.target.value }))} /></label>
            <label>Telephone principal<input value={teacherForm.primaryPhone} onChange={(event) => setTeacherForm((prev) => ({ ...prev, primaryPhone: event.target.value }))} /></label>
            <label>Telephone secondaire<input value={teacherForm.secondaryPhone} onChange={(event) => setTeacherForm((prev) => ({ ...prev, secondaryPhone: event.target.value }))} /></label>
            <label>Email<input type="email" value={teacherForm.email} onChange={(event) => setTeacherForm((prev) => ({ ...prev, email: event.target.value }))} /></label>
            <label>Date embauche<input type="date" value={teacherForm.hireDate} onChange={(event) => setTeacherForm((prev) => ({ ...prev, hireDate: event.target.value }))} /></label>
            <label>Type<select value={teacherForm.teacherType} onChange={(event) => setTeacherForm((prev) => ({ ...prev, teacherType: event.target.value }))}>{TEACHER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label>Specialite<input value={teacherForm.speciality} onChange={(event) => setTeacherForm((prev) => ({ ...prev, speciality: event.target.value }))} /></label>
            <label>Diplome principal<input value={teacherForm.mainDiploma} onChange={(event) => setTeacherForm((prev) => ({ ...prev, mainDiploma: event.target.value }))} /></label>
            <label>Langue enseignement<input value={teacherForm.teachingLanguage} onChange={(event) => setTeacherForm((prev) => ({ ...prev, teachingLanguage: event.target.value }))} /></label>
            <label>Statut<select value={teacherForm.status} onChange={(event) => setTeacherForm((prev) => ({ ...prev, status: event.target.value }))}>{TEACHER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label>Etablissement<select value={teacherForm.establishmentId} onChange={(event) => setTeacherForm((prev) => ({ ...prev, establishmentId: event.target.value }))}><option value="">Al Manarat Islamiyat</option></select></label>
            <label>Compte utilisateur<select value={teacherForm.userId} onChange={(event) => setTeacherForm((prev) => ({ ...prev, userId: event.target.value }))}><option value="">Non lie</option>{teacherUsers.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}</select></label>
            <label>Nationalite<input value={teacherForm.nationality} onChange={(event) => setTeacherForm((prev) => ({ ...prev, nationality: event.target.value }))} /></label>
            <label>Piece type<input value={teacherForm.identityDocumentType} onChange={(event) => setTeacherForm((prev) => ({ ...prev, identityDocumentType: event.target.value }))} /></label>
            <label>Piece numero<input value={teacherForm.identityDocumentNumber} onChange={(event) => setTeacherForm((prev) => ({ ...prev, identityDocumentNumber: event.target.value }))} /></label>
            <label className="form-grid-span-full">Adresse<input value={teacherForm.address} onChange={(event) => setTeacherForm((prev) => ({ ...prev, address: event.target.value }))} /></label>
            <label className="form-grid-span-full">Notes internes<textarea value={teacherForm.internalNotes} onChange={(event) => setTeacherForm((prev) => ({ ...prev, internalNotes: event.target.value }))} /></label>
            <div className="actions">
              <button type="submit">{editingTeacherId ? "Mettre a jour" : "Creer enseignant"}</button>
              <button type="button" className="button-ghost" onClick={() => { setEditingTeacherId(null); setTeacherForm(defaultTeacherForm()); }}>Reinitialiser</button>
              <button type="button" className="button-ghost" onClick={() => setActiveStep("list")}>Retour liste</button>
            </div>
          </form>
        </section>
      ) : null}

      {activeStep === "detail" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header">
            <div>
              <p className="section-kicker">Dossier enseignant</p>
              <h2>{detail?.fullName || selectedTeacher?.fullName || "Detail enseignant"}</h2>
            </div>
            <div className="module-inline-strip">
              <button type="button" className="button-ghost" onClick={() => selectedTeacher && editTeacher(selectedTeacher)}>Modifier</button>
              <button type="button" onClick={() => setActiveStep("assignments")}>Affecter</button>
            </div>
          </div>
          {!detail ? (
            <p className="section-lead">Selectionnez un enseignant depuis la liste.</p>
          ) : (
            <div className="teachers-detail-grid">
              <article className="module-overview-card teachers-identity-card">
                <span>{detail.matricule}</span>
                <strong>{detail.fullName}</strong>
                <small>{detail.teacherType} - {detail.status}</small>
                <small>{detail.primaryPhone || "Telephone non renseigne"} - {detail.email || "Email non renseigne"}</small>
              </article>
              <article className="module-overview-card"><span>Competences</span><strong>{detail.skills.length}</strong><small>Perimetres autorises</small></article>
              <article className="module-overview-card"><span>Affectations</span><strong>{detail.assignments.length}</strong><small>Historique complet</small></article>
              <article className="module-overview-card"><span>Charge francophone</span><strong>{detail.francophoneWorkloadHoursTotal} h</strong><small>{detail.assignments.filter((item) => item.track === "FRANCOPHONE").length} affectation(s)</small></article>
              <article className="module-overview-card"><span>Charge arabophone</span><strong>{detail.arabophoneWorkloadHoursTotal} h</strong><small>{detail.assignments.filter((item) => item.track === "ARABOPHONE").length} affectation(s)</small></article>
              <article className="module-overview-card"><span>Documents</span><strong>{detail.documents.length}</strong><small>Pieces rattachees</small></article>
            </div>
          )}
        </section>
      ) : null}

      {activeStep === "skills" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">Competences pedagogiques</p><h2>Ce que l'enseignant peut enseigner</h2></div></div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitSkill}>
            <label>Enseignant<select value={skillForm.teacherId} onChange={(event) => setSkillForm((prev) => ({ ...prev, teacherId: event.target.value }))} required><option value="">Choisir</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select></label>
            <label>Matiere<select value={skillForm.subjectId} onChange={(event) => setSkillForm((prev) => ({ ...prev, subjectId: event.target.value }))} required><option value="">Choisir</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}</select></label>
            <label>Cursus<select value={skillForm.track} onChange={(event) => setSkillForm((prev) => ({ ...prev, track: event.target.value as AcademicTrack }))} required>{TRACKS.map((track) => <option key={track} value={track}>{trackLabel(track)}</option>)}</select></label>
            <label>Cycle<select value={skillForm.cycleId} onChange={(event) => setSkillForm((prev) => ({ ...prev, cycleId: event.target.value }))}><option value="">Tous</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}</select></label>
            <label>Niveau<select value={skillForm.levelId} onChange={(event) => setSkillForm((prev) => ({ ...prev, levelId: event.target.value }))}><option value="">Tous</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}</select></label>
            <label>Qualification<input value={skillForm.qualification} onChange={(event) => setSkillForm((prev) => ({ ...prev, qualification: event.target.value }))} /></label>
            <label>Experience<input type="number" min="0" value={skillForm.yearsExperience} onChange={(event) => setSkillForm((prev) => ({ ...prev, yearsExperience: event.target.value }))} /></label>
            <label>Priorite<input type="number" min="0" value={skillForm.priority} onChange={(event) => setSkillForm((prev) => ({ ...prev, priority: event.target.value }))} /></label>
            <label>Statut<select value={skillForm.status} onChange={(event) => setSkillForm((prev) => ({ ...prev, status: event.target.value }))}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></label>
            <label className="form-grid-span-full">Commentaire<input value={skillForm.comment} onChange={(event) => setSkillForm((prev) => ({ ...prev, comment: event.target.value }))} /></label>
            <div className="actions"><button type="submit">Ajouter competence</button></div>
          </form>
          <div className="table-wrap">
            <table><thead><tr><th>Enseignant</th><th>Matiere</th><th>Cursus</th><th>Cycle</th><th>Niveau</th><th>Qualification</th><th>Statut</th><th>Action</th></tr></thead>
              <tbody>{selectedTeacherSkills.length === 0 ? <tr><td colSpan={8} className="empty-row">Aucune competence.</td></tr> : selectedTeacherSkills.map((skill) => (
                <tr key={skill.id}><td>{skill.teacherName}</td><td>{skill.subjectLabel}</td><td>{trackLabel(skill.track)}</td><td>{skill.cycleLabel || "Tous"}</td><td>{skill.levelLabel || "Tous"}</td><td>{skill.qualification || "-"}</td><td>{skill.status}</td><td><button type="button" className="button-ghost" onClick={() => void archiveResource(`/teachers/skills/${skill.id}`, "Competence supprimee.")}>Supprimer</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeStep === "assignments" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">Affectations pedagogiques</p><h2>Ce que l'enseignant enseigne reellement</h2></div></div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitAssignment}>
            <label>Enseignant<select value={assignmentForm.teacherId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, teacherId: event.target.value }))} required><option value="">Choisir</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select></label>
            <label>Annee scolaire<select value={assignmentForm.schoolYearId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, schoolYearId: event.target.value }))} required><option value="">Choisir</option>{schoolYears.map((year) => <option key={year.id} value={year.id}>{year.label || year.code}</option>)}</select></label>
            <label>Classe<select value={assignmentForm.classId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, classId: event.target.value }))} required><option value="">Choisir</option>{filteredClasses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>Matiere<select value={assignmentForm.subjectId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, subjectId: event.target.value }))} required><option value="">Choisir</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}</select></label>
            <label>Cursus<select value={assignmentForm.track} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, track: event.target.value as AcademicTrack }))} required>{TRACKS.map((track) => <option key={track} value={track}>{trackLabel(track)}</option>)}</select></label>
            <label>Periode<select value={assignmentForm.periodId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, periodId: event.target.value }))}><option value="">Optionnelle</option>{filteredPeriods.map((period) => <option key={period.id} value={period.id}>{period.label}</option>)}</select></label>
            <label>Volume horaire<input type="number" min="0" step="0.5" value={assignmentForm.workloadHours} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, workloadHours: event.target.value }))} /></label>
            <label>Coefficient<input type="number" min="0" step="0.25" value={assignmentForm.coefficient} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, coefficient: event.target.value }))} /></label>
            <label>Debut<input type="date" value={assignmentForm.startDate} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, startDate: event.target.value }))} required /></label>
            <label>Fin<input type="date" value={assignmentForm.endDate} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, endDate: event.target.value }))} /></label>
            <label>Statut<select value={assignmentForm.status} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, status: event.target.value }))}>{ASSIGNMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label>Role<input value={assignmentForm.role} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, role: event.target.value }))} placeholder="Professeur principal, intervenant..." /></label>
            <label className="check-row"><input type="checkbox" checked={assignmentForm.isHomeroomTeacher} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, isHomeroomTeacher: event.target.checked }))} /> Professeur principal</label>
            <label className="form-grid-span-full">Commentaire<input value={assignmentForm.comment} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, comment: event.target.value }))} /></label>
            <div className="actions"><button type="submit">Creer affectation</button></div>
          </form>
          <div className="table-wrap">
            <table><thead><tr><th>Enseignant</th><th>Matiere</th><th>Cursus</th><th>Classe</th><th>Annee</th><th>Periode</th><th>Charge</th><th>Titulaire</th><th>Statut</th><th>Action</th></tr></thead>
              <tbody>{selectedTeacherAssignments.length === 0 ? <tr><td colSpan={10} className="empty-row">Aucune affectation.</td></tr> : selectedTeacherAssignments.map((item) => (
                <tr key={item.id}><td>{item.teacherName}</td><td>{item.subjectLabel}</td><td>{trackLabel(item.track)}</td><td>{item.classLabel}</td><td>{item.schoolYearCode}</td><td>{item.periodLabel || "-"}</td><td>{item.workloadHours ?? 0} h</td><td>{item.isHomeroomTeacher ? "Oui" : "Non"}</td><td>{item.status}</td><td><button type="button" className="button-ghost" onClick={() => void archiveResource(`/teachers/assignments/${item.id}`, "Affectation archivee.")}>Archiver</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeStep === "workloads" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">Charge pedagogique</p><h2>Synthese par enseignant</h2></div></div>
          <div className="table-wrap">
            <table><thead><tr><th>Matricule</th><th>Enseignant</th><th>Affectations</th><th>Total horaire</th><th>Francophone</th><th>Arabophone</th><th>Classes</th><th>Matieres</th><th>Statut</th></tr></thead>
              <tbody>{workloads.length === 0 ? <tr><td colSpan={9} className="empty-row">Aucune charge calculee.</td></tr> : workloads.map((item) => (
                <tr key={item.teacherId}><td>{item.matricule}</td><td>{item.teacherName}</td><td>{item.assignmentsCount}</td><td>{item.workloadHoursTotal} h</td><td>{item.francophoneHoursTotal} h</td><td>{item.arabophoneHoursTotal} h</td><td>{item.classes.join(", ") || "-"}</td><td>{item.subjects.join(", ") || "-"}</td><td>{item.status}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeStep === "documents" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">Dossier administratif</p><h2>Documents enseignant</h2></div></div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitDocument}>
            <label>Enseignant<select value={documentForm.teacherId} onChange={(event) => setDocumentForm((prev) => ({ ...prev, teacherId: event.target.value }))} required><option value="">Choisir</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select></label>
            <label>Type document<select value={documentForm.documentType} onChange={(event) => setDocumentForm((prev) => ({ ...prev, documentType: event.target.value }))}>{DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label>Nom original<input value={documentForm.originalName} onChange={(event) => setDocumentForm((prev) => ({ ...prev, originalName: event.target.value }))} required /></label>
            <label>URL fichier<input value={documentForm.fileUrl} onChange={(event) => setDocumentForm((prev) => ({ ...prev, fileUrl: event.target.value }))} required /></label>
            <label>Mime type<input value={documentForm.mimeType} onChange={(event) => setDocumentForm((prev) => ({ ...prev, mimeType: event.target.value }))} /></label>
            <label>Taille octets<input type="number" min="0" value={documentForm.size} onChange={(event) => setDocumentForm((prev) => ({ ...prev, size: event.target.value }))} /></label>
            <div className="actions"><button type="submit">Referencer document</button></div>
          </form>
          <div className="table-wrap">
            <table><thead><tr><th>Enseignant</th><th>Type</th><th>Nom</th><th>Mime</th><th>Ajoute le</th><th>Statut</th><th>Action</th></tr></thead>
              <tbody>{selectedTeacherDocuments.length === 0 ? <tr><td colSpan={7} className="empty-row">Aucun document.</td></tr> : selectedTeacherDocuments.map((document) => (
                <tr key={document.id}><td>{document.teacherName}</td><td>{document.documentType}</td><td><a href={document.fileUrl} target="_blank" rel="noreferrer">{document.originalName}</a></td><td>{document.mimeType || "-"}</td><td>{new Date(document.uploadedAt).toLocaleDateString()}</td><td>{document.status}</td><td><button type="button" className="button-ghost" onClick={() => void archiveResource(`/teachers/documents/${document.id}`, "Document archive.")}>Archiver</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}
    </WorkflowGuide>
  );
}
