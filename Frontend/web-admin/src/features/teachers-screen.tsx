import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
  UserAccount
} from "../shared/types/app";
import { TeachersListSection, TeachersSummarySection } from "./teachers/components/teachers-list-section";
import {
  buildPreviewTeachersModuleData,
  filterPreviewTeachers
} from "./teachers/teachers-preview-data";
import {
  createTeacherAssignment,
  createTeacherDocument,
  createTeacherSkill,
  deleteTeacherResource,
  downloadTeacherDocument,
  fetchTeacherDetail,
  fetchTeachers,
  fetchTeachersModule,
  saveTeacher
} from "./teachers/teachers-service";
import {
  ASSIGNMENT_STATUSES,
  DOCUMENT_TYPES,
  SCHOOL_NAME,
  TEACHER_STATUSES,
  TEACHER_TYPES,
  TEACHER_DOCUMENT_ACCEPT,
  TEACHER_DOCUMENT_MAX_SIZE_BYTES,
  TRACKS,
  documentTypeLabel,
  fileNameWithoutExtension,
  formatFileSize,
  isAllowedTeacherDocumentMimeType,
  type SkillForm,
  type TeacherAssignmentForm,
  type TeacherDocumentForm,
  type TeacherFilters,
  type TeacherForm,
  defaultAssignmentForm,
  defaultDocumentForm,
  defaultSkillForm,
  defaultTeacherFilters,
  defaultTeacherForm,
  emptyToUndefined,
  numberOrUndefined,
  statusPillClass,
  teacherStatusLabel,
  teacherTypeLabel,
  today,
  trackLabel
} from "./teachers/teachers-screen-model";
import { translateUiString, UI_MESSAGES, type UiLanguage } from "../shared/i18n";
import { useI18n } from "../shared/i18n-context";
import { toUiErrorMessage } from "../shared/services/api-errors";


type TeachersScreenProps = {
  api: (path: string, init?: RequestInit) => Promise<Response>;
  classes: ClassItem[];
  cycles: Cycle[];
  levels: Level[];
  periods: Period[];
  schoolYears: SchoolYear[];
  subjects: Subject[];
  users: UserAccount[];
  language?: UiLanguage;
  remoteEnabled?: boolean;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

export function TeachersScreen(props: TeachersScreenProps): JSX.Element {
  const { t: tr } = useI18n();
  const {
    api,
    classes,
    cycles,
    language = "fr",
    levels,
    onError,
    onNotice,
    periods,
    remoteEnabled = true,
    schoolYears,
    subjects,
    users
  } = props;
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
  const [filters, setFilters] = useState<TeacherFilters>(defaultTeacherFilters);
  const [teacherForm, setTeacherForm] = useState<TeacherForm>(defaultTeacherForm);
  const [skillForm, setSkillForm] = useState<SkillForm>(defaultSkillForm);
  const [assignmentForm, setAssignmentForm] = useState<TeacherAssignmentForm>(defaultAssignmentForm);
  const [documentForm, setDocumentForm] = useState<TeacherDocumentForm>(defaultDocumentForm);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentFileError, setDocumentFileError] = useState("");
  const [documentUploading, setDocumentUploading] = useState(false);
  const documentFileInputRef = useRef<HTMLInputElement | null>(null);

  const activeSchoolYear = useMemo(
    () => schoolYears.find((item) => item.isActive) || schoolYears[0],
    [schoolYears]
  );
  const teacherUsers = useMemo(
    () => users.filter((user) => user.role === "ENSEIGNANT" && user.isActive),
    [users]
  );
  const previewTeachersModule = useMemo(
    () => buildPreviewTeachersModuleData({ classes, schoolYears, subjects }),
    [classes, schoolYears, subjects]
  );
  const selectedTeacher = teachers.find((teacher) => teacher.id === selectedTeacherId) || teachers[0];

  const loadTeachers = async (): Promise<void> => {
    if (!remoteEnabled) {
      const rows = filterPreviewTeachers(previewTeachersModule.teachers, filters, previewTeachersModule.skills);
      setTeachers(rows);
      if (!selectedTeacherId && rows[0]) setSelectedTeacherId(rows[0].id);
      return;
    }
    try {
      const rows = await fetchTeachers(api, filters);
      setTeachers(rows);
      if (!selectedTeacherId && rows[0]) setSelectedTeacherId(rows[0].id);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
    }
  };

  const loadModule = async (): Promise<void> => {
    if (!remoteEnabled) {
      setTeachers(previewTeachersModule.teachers);
      setSkills(previewTeachersModule.skills);
      setAssignments(previewTeachersModule.assignments);
      setDocuments(previewTeachersModule.documents);
      setWorkloads(previewTeachersModule.workloads);
      if (!selectedTeacherId && previewTeachersModule.teachers[0]) {
        setSelectedTeacherId(previewTeachersModule.teachers[0].id);
      }
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchTeachersModule(api, activeSchoolYear?.id);
      setTeachers(data.teachers);
      setSkills(data.skills);
      setAssignments(data.assignments);
      setDocuments(data.documents);
      setWorkloads(data.workloads);
      if (!selectedTeacherId && data.teachers[0]) setSelectedTeacherId(data.teachers[0].id);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (teacherId: string): Promise<void> => {
    if (!teacherId) return;
    if (!remoteEnabled) {
      setDetail(previewTeachersModule.details.find((teacher) => teacher.id === teacherId) || null);
      return;
    }
    try {
      setDetail(await fetchTeacherDetail(api, teacherId));
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
    }
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

  const translate = (value: string): string => translateUiString(language, value);
  const translateDocumentType = (value?: string): string => translate(documentTypeLabel(value));
  const locale = language === "en" ? "en-US" : language === "ar" ? "ar" : "fr-FR";

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
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      setEditingTeacherId(null);
      setTeacherForm(defaultTeacherForm());
      setActiveStep("list");
      return;
    }
    let saved: TeacherRecord;
    try {
      saved = await saveTeacher(api, editingTeacherId, payload);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }
    setSelectedTeacherId(saved.id);
    setEditingTeacherId(null);
    setTeacherForm(defaultTeacherForm());
    onNotice(UI_MESSAGES.teacherSaved);
    await loadModule();
    setActiveStep("detail");
  };

  const submitSkill = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }
    try {
      await createTeacherSkill(api, {
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
      });
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }
    onNotice(UI_MESSAGES.teacherSkillAdded);
    setSkillForm((prev) => ({ ...defaultSkillForm(), teacherId: prev.teacherId }));
    await loadModule();
  };

  const submitAssignment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }
    try {
      await createTeacherAssignment(api, {
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
      });
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }
    onNotice(UI_MESSAGES.teacherAssignmentCreated);
    setAssignmentForm((prev) => ({ ...defaultAssignmentForm(), teacherId: prev.teacherId, schoolYearId: prev.schoolYearId }));
    await loadModule();
  };

  const validateDocumentFile = (file: File | null): string => {
    if (!file) return translate(UI_MESSAGES.documentFileRequired);
    if (!isAllowedTeacherDocumentMimeType(file.type)) return translate(UI_MESSAGES.documentTypeForbidden);
    if (file.size > TEACHER_DOCUMENT_MAX_SIZE_BYTES) {
      return translate(UI_MESSAGES.documentTooLarge);
    }
    return "";
  };

  const handleDocumentFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0] || null;
    const validationError = validateDocumentFile(file);
    setDocumentFile(file);
    setDocumentFileError(validationError);
    if (file && !documentForm.documentName.trim()) {
      setDocumentForm((prev) => ({ ...prev, documentName: fileNameWithoutExtension(file.name) }));
    }
  };

  const clearDocumentFile = (): void => {
    setDocumentFile(null);
    setDocumentFileError("");
    if (documentFileInputRef.current) documentFileInputRef.current.value = "";
  };

  const submitDocument = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const validationError = validateDocumentFile(documentFile);
    if (validationError) {
      setDocumentFileError(validationError);
      onError(validationError);
      return;
    }
    if (!documentFile) return;
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      clearDocumentFile();
      setDocumentForm((prev) => ({ ...defaultDocumentForm(), teacherId: prev.teacherId }));
      return;
    }
    setDocumentUploading(true);
    try {
      await createTeacherDocument(api, documentForm.teacherId, {
        documentType: documentForm.documentType,
        documentName: documentForm.documentName,
        status: documentForm.status
      }, documentFile);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.uploadError));
      setDocumentUploading(false);
      return;
    }
    onNotice(UI_MESSAGES.documentAdded);
    setDocumentForm((prev) => ({ ...defaultDocumentForm(), teacherId: prev.teacherId }));
    setDocumentFile(null);
    setDocumentFileError("");
    if (documentFileInputRef.current) documentFileInputRef.current.value = "";
    setDocumentUploading(false);
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

  const downloadDocument = async (document: TeacherDocumentRecord): Promise<void> => {
    try {
      await downloadTeacherDocument(api, document);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.downloadError));
    }
  };

  const openTeacherForm = (): void => {
    setEditingTeacherId(null);
    setTeacherForm(defaultTeacherForm());
    setActiveStep("form");
  };

  const archiveResource = async (path: string, successMessage: string, confirmMessage?: string): Promise<void> => {
    if (confirmMessage && !window.confirm(translate(confirmMessage))) return;
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }
    try {
      await deleteTeacherResource(api, path);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.deleteError));
      return;
    }
    onNotice(successMessage);
    await loadModule();
  };

  const openDetail = (teacherId: string): void => {
    setSelectedTeacherId(teacherId);
    setActiveStep("detail");
    if (!remoteEnabled) return;
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

  const teacherTabs = [
    { id: "list", label: translate("Liste") },
    { id: "skills", label: translate("Compétences") },
    { id: "assignments", label: translate("Affectations") },
    { id: "workloads", label: translate("Charges") },
    { id: "documents", label: translate("Documents") }
  ];

  return (
    <div className="teachers-v3-shell">
      <header className="teachers-v3-page-header">
        <div>
          <h1>{translate("Enseignants")}</h1>
          <p>{translate("Pilotez les fiches enseignants, affectations, compétences et charges pédagogiques.")}</p>
        </div>
        {activeStep === "list" ? (
          <button type="button" onClick={openTeacherForm}>{translate("Ajouter un enseignant")}</button>
        ) : (
          <button type="button" className="button-ghost" onClick={() => setActiveStep("list")}>
            {translate("Retour à la liste")}
          </button>
        )}
      </header>

      <nav className="teachers-v3-step-tabs" role="tablist" aria-label={translate("Navigation enseignants")}>
        {teacherTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeStep === tab.id}
            className={activeStep === tab.id ? "is-active" : ""}
            onClick={() => setActiveStep(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeStep === "list" ? (
        <TeachersSummarySection
          assignments={assignments}
          language={language}
          loading={loading}
          skills={skills}
          teachers={teachers}
          workloads={workloads}
        />
      ) : null}

      {activeStep === "list" ? (
        <TeachersListSection
          filters={filters}
          loading={loading}
          onArchiveTeacher={(teacherId) =>
            void archiveResource(`/teachers/${teacherId}`, UI_MESSAGES.archived, UI_MESSAGES.confirmArchive)
          }
          onEditTeacher={editTeacher}
          onFilter={() => void loadTeachers()}
          onOpenDetail={openDetail}
          onReload={() => void loadModule()}
          setFilters={setFilters}
          language={language}
          subjects={subjects}
          teachers={teachers}
        />
      ) : null}

      {activeStep === "form" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header">
            <div>
              <p className="section-kicker">{tr("Fiche enseignant")}</p>
              <h2>{editingTeacherId ? tr("Modifier l'enseignant") : tr("Ajouter un enseignant")}</h2>
            </div>
            <span className="module-header-badge">{SCHOOL_NAME}</span>
          </div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitTeacher}>
            <label>{tr("Matricule *")}<input value={teacherForm.matricule} onChange={(event) => setTeacherForm((prev) => ({ ...prev, matricule: event.target.value }))} required /></label>
            <label>{tr("Prénom *")}<input value={teacherForm.firstName} onChange={(event) => setTeacherForm((prev) => ({ ...prev, firstName: event.target.value }))} required /></label>
            <label>{tr("Nom *")}<input value={teacherForm.lastName} onChange={(event) => setTeacherForm((prev) => ({ ...prev, lastName: event.target.value }))} required /></label>
            <label>{tr("Sexe *")}<select value={teacherForm.sex} onChange={(event) => setTeacherForm((prev) => ({ ...prev, sex: event.target.value as TeacherForm["sex"] }))} required><option value="">{tr("Choisir")}</option><option value="M">{tr("M")}</option><option value="F">{tr("F")}</option></select></label>
            <label>{tr("Date de naissance")}<input type="date" value={teacherForm.birthDate} onChange={(event) => setTeacherForm((prev) => ({ ...prev, birthDate: event.target.value }))} /></label>
            <label>{tr("Téléphone principal")}<input value={teacherForm.primaryPhone} onChange={(event) => setTeacherForm((prev) => ({ ...prev, primaryPhone: event.target.value }))} required={!teacherForm.email} /></label>
            <label>{tr("Téléphone secondaire")}<input value={teacherForm.secondaryPhone} onChange={(event) => setTeacherForm((prev) => ({ ...prev, secondaryPhone: event.target.value }))} /></label>
            <label>{tr("Email")}<input type="email" value={teacherForm.email} onChange={(event) => setTeacherForm((prev) => ({ ...prev, email: event.target.value }))} /></label>
            <label>{tr("Date d'embauche")}<input type="date" value={teacherForm.hireDate} onChange={(event) => setTeacherForm((prev) => ({ ...prev, hireDate: event.target.value }))} /></label>
            <label>{tr("Type *")}<select value={teacherForm.teacherType} onChange={(event) => setTeacherForm((prev) => ({ ...prev, teacherType: event.target.value }))} required>{TEACHER_TYPES.map((type) => <option key={type} value={type}>{tr(teacherTypeLabel(type))}</option>)}</select></label>
            <label>{tr("Spécialité")}<input value={teacherForm.speciality} onChange={(event) => setTeacherForm((prev) => ({ ...prev, speciality: event.target.value }))} /></label>
            <label>{tr("Diplôme principal")}<input value={teacherForm.mainDiploma} onChange={(event) => setTeacherForm((prev) => ({ ...prev, mainDiploma: event.target.value }))} /></label>
            <label>{tr("Langue d'enseignement *")}<select value={teacherForm.teachingLanguage} onChange={(event) => setTeacherForm((prev) => ({ ...prev, teachingLanguage: event.target.value }))} required><option value="Français">{tr("Français")}</option><option value="Arabe">{tr("Arabe")}</option><option value="Français / Arabe">{tr("Français / Arabe")}</option></select></label>
            <label>{tr("Statut *")}<select value={teacherForm.status} onChange={(event) => setTeacherForm((prev) => ({ ...prev, status: event.target.value }))} required>{TEACHER_STATUSES.map((status) => <option key={status} value={status}>{tr(teacherStatusLabel(status))}</option>)}</select></label>
            <label>{tr("Établissement")}<select value={teacherForm.establishmentId} onChange={(event) => setTeacherForm((prev) => ({ ...prev, establishmentId: event.target.value }))}><option value="">{tr("Al Manarat Islamiyat")}</option></select></label>
            <label>{tr("Compte utilisateur lié")}<select value={teacherForm.userId} onChange={(event) => setTeacherForm((prev) => ({ ...prev, userId: event.target.value }))}><option value="">{tr("Non lié")}</option>{teacherUsers.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}</select></label>
            <label>{tr("Nationalité")}<input value={teacherForm.nationality} onChange={(event) => setTeacherForm((prev) => ({ ...prev, nationality: event.target.value }))} /></label>
            <label>{tr("Type de pièce")}<input value={teacherForm.identityDocumentType} onChange={(event) => setTeacherForm((prev) => ({ ...prev, identityDocumentType: event.target.value }))} /></label>
            <label>{tr("Numéro de pièce")}<input value={teacherForm.identityDocumentNumber} onChange={(event) => setTeacherForm((prev) => ({ ...prev, identityDocumentNumber: event.target.value }))} /></label>
            <label className="form-grid-span-full">{tr("Adresse")}<input value={teacherForm.address} onChange={(event) => setTeacherForm((prev) => ({ ...prev, address: event.target.value }))} /></label>
            <label className="form-grid-span-full">{tr("Notes internes")}<textarea value={teacherForm.internalNotes} onChange={(event) => setTeacherForm((prev) => ({ ...prev, internalNotes: event.target.value }))} /></label>
            <div className="actions">
              <button type="submit">{editingTeacherId ? tr("Enregistrer les modifications") : tr("Créer l'enseignant")}</button>
              <button type="button" className="button-ghost" onClick={() => { setEditingTeacherId(null); setTeacherForm(defaultTeacherForm()); }}>{tr("Réinitialiser")}</button>
              <button type="button" className="button-ghost" onClick={() => setActiveStep("list")}>{tr("Retour à la liste")}</button>
            </div>
          </form>
        </section>
      ) : null}

      {activeStep === "detail" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header">
            <div>
              <p className="section-kicker">{tr("Dossier enseignant")}</p>
              <h2>{detail?.fullName || selectedTeacher?.fullName || tr("Détail enseignant")}</h2>
            </div>
            {detail || selectedTeacher ? (
              <div className="module-inline-strip">
                <button type="button" className="button-ghost" onClick={() => selectedTeacher && editTeacher(selectedTeacher)}>{tr("Modifier")}</button>
                <button type="button" onClick={() => setActiveStep("assignments")}>{tr("Affecter")}</button>
              </div>
            ) : null}
          </div>
          {!detail ? (
            <div className="empty-state-block">
              <p className="section-lead">{tr("Sélectionnez un enseignant depuis la liste.")}</p>
              <p>{tr("Choisissez un enseignant dans la liste pour consulter ou modifier sa fiche.")}</p>
            </div>
          ) : (
            <div className="teachers-detail-grid">
              <article className="module-overview-card teachers-identity-card">
                <span>{detail.matricule}</span>
                <strong>{detail.fullName}</strong>
                <small>{tr(teacherTypeLabel(detail.teacherType))} - {tr(teacherStatusLabel(detail.status))}</small>
                <small>{detail.primaryPhone || tr("Téléphone non renseigné")} - {detail.email || tr("Email non renseigné")}</small>
              </article>
              <article className="module-overview-card"><span>{tr("Compétences")}</span><strong>{detail.skills.length}</strong><small>{tr("Périmètres autorisés")}</small></article>
              <article className="module-overview-card"><span>{tr("Affectations")}</span><strong>{detail.assignments.length}</strong><small>{tr("Historique complet")}</small></article>
              <article className="module-overview-card"><span>{tr("Charge francophone")}</span><strong>{detail.francophoneWorkloadHoursTotal} {tr("h")}</strong><small>{detail.assignments.filter((item) => item.track === "FRANCOPHONE").length} {tr("affectation(s)")}</small></article>
              <article className="module-overview-card"><span>{tr("Charge arabophone")}</span><strong>{detail.arabophoneWorkloadHoursTotal} {tr("h")}</strong><small>{detail.assignments.filter((item) => item.track === "ARABOPHONE").length} {tr("affectation(s)")}</small></article>
              <article className="module-overview-card"><span>{tr("Documents")}</span><strong>{detail.documents.length}</strong><small>{tr("Pièces rattachées")}</small></article>
            </div>
          )}
        </section>
      ) : null}

      {activeStep === "skills" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">{tr("Compétences pédagogiques")}</p><h2>{tr("Ce que l'enseignant peut enseigner")}</h2></div></div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitSkill}>
            <label>{tr("Enseignant *")}<select value={skillForm.teacherId} onChange={(event) => setSkillForm((prev) => ({ ...prev, teacherId: event.target.value }))} required><option value="">{tr("Choisir")}</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select></label>
            <label>{tr("Matière *")}<select value={skillForm.subjectId} onChange={(event) => setSkillForm((prev) => ({ ...prev, subjectId: event.target.value }))} required><option value="">{tr("Choisir")}</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}</select></label>
            <label>{tr("Cursus *")}<select value={skillForm.track} onChange={(event) => setSkillForm((prev) => ({ ...prev, track: event.target.value as AcademicTrack }))} required>{TRACKS.map((track) => <option key={track} value={track}>{tr(trackLabel(track))}</option>)}</select></label>
            <label>{tr("Cycle")}<select value={skillForm.cycleId} onChange={(event) => setSkillForm((prev) => ({ ...prev, cycleId: event.target.value }))}><option value="">{tr("Tous")}</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}</select></label>
            <label>{tr("Niveau")}<select value={skillForm.levelId} onChange={(event) => setSkillForm((prev) => ({ ...prev, levelId: event.target.value }))}><option value="">{tr("Tous")}</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}</select></label>
            <label>{tr("Qualification")}<input value={skillForm.qualification} onChange={(event) => setSkillForm((prev) => ({ ...prev, qualification: event.target.value }))} /></label>
            <label>{tr("Expérience")}<input type="number" min="0" value={skillForm.yearsExperience} onChange={(event) => setSkillForm((prev) => ({ ...prev, yearsExperience: event.target.value }))} /></label>
            <label>{tr("Priorité")}<input type="number" min="0" value={skillForm.priority} onChange={(event) => setSkillForm((prev) => ({ ...prev, priority: event.target.value }))} /></label>
            <label>{tr("Statut *")}<select value={skillForm.status} onChange={(event) => setSkillForm((prev) => ({ ...prev, status: event.target.value }))} required><option value="ACTIVE">{tr("Actif")}</option><option value="INACTIVE">{tr("Inactif")}</option></select></label>
            <label className="form-grid-span-full">{tr("Commentaire")}<input value={skillForm.comment} onChange={(event) => setSkillForm((prev) => ({ ...prev, comment: event.target.value }))} /></label>
            <div className="actions"><button type="submit">{tr("Ajouter la compétence")}</button></div>
          </form>
          <div className="table-wrap">
            <table data-responsive-table="true"><thead><tr><th>{tr("Enseignant")}</th><th>{tr("Matière")}</th><th>{tr("Cursus")}</th><th>{tr("Cycle")}</th><th>{tr("Niveau")}</th><th>{tr("Qualification")}</th><th>{tr("Statut")}</th><th>{tr("Actions")}</th></tr></thead>
              <tbody>{selectedTeacherSkills.length === 0 ? <tr><td colSpan={8} className="empty-row">{tr("Aucune compétence enregistrée.")}</td></tr> : selectedTeacherSkills.map((skill) => (
                <tr key={skill.id}><td data-label={tr("Enseignant")}>{skill.teacherName}</td><td data-label={tr("Matière")}>{skill.subjectLabel}</td><td data-label={tr("Cursus")}>{tr(trackLabel(skill.track))}</td><td data-label={tr("Cycle")}>{skill.cycleLabel || tr("Tous")}</td><td data-label={tr("Niveau")}>{skill.levelLabel || tr("Tous")}</td><td data-label={tr("Qualification")}>{skill.qualification || "-"}</td><td data-label={tr("Statut")}><span className={statusPillClass(skill.status)}>{tr(teacherStatusLabel(skill.status))}</span></td><td data-label={tr("Actions")}><button type="button" className="button-danger" onClick={() => void archiveResource(`/teachers/skills/${skill.id}`, UI_MESSAGES.deleted, UI_MESSAGES.confirmDelete)}>{tr("Supprimer")}</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeStep === "assignments" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">{tr("Affectations pédagogiques")}</p><h2>{tr("Ce que l'enseignant enseigne réellement")}</h2></div></div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitAssignment}>
            <label>{tr("Enseignant *")}<select value={assignmentForm.teacherId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, teacherId: event.target.value }))} required><option value="">{tr("Choisir")}</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select></label>
            <label>{tr("Année scolaire *")}<select value={assignmentForm.schoolYearId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, schoolYearId: event.target.value }))} required><option value="">{tr("Choisir")}</option>{schoolYears.map((year) => <option key={year.id} value={year.id}>{year.label || year.code}</option>)}</select></label>
            <label>{tr("Classe *")}<select value={assignmentForm.classId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, classId: event.target.value }))} required><option value="">{tr("Choisir")}</option>{filteredClasses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>{tr("Matière *")}<select value={assignmentForm.subjectId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, subjectId: event.target.value }))} required><option value="">{tr("Choisir")}</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}</select></label>
            <label>{tr("Cursus *")}<select value={assignmentForm.track} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, track: event.target.value as AcademicTrack }))} required>{TRACKS.map((track) => <option key={track} value={track}>{tr(trackLabel(track))}</option>)}</select></label>
            <label>{tr("Période")}<select value={assignmentForm.periodId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, periodId: event.target.value }))}><option value="">{tr("Optionnelle")}</option>{filteredPeriods.map((period) => <option key={period.id} value={period.id}>{period.label}</option>)}</select></label>
            <label>{tr("Volume horaire")}<input type="number" min="0" step="0.5" value={assignmentForm.workloadHours} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, workloadHours: event.target.value }))} /></label>
            <label>{tr("Coefficient")}<input type="number" min="0" step="0.25" value={assignmentForm.coefficient} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, coefficient: event.target.value }))} /></label>
            <label>{tr("Début *")}<input type="date" value={assignmentForm.startDate} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, startDate: event.target.value }))} required /></label>
            <label>{tr("Fin")}<input type="date" value={assignmentForm.endDate} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, endDate: event.target.value }))} /></label>
            <label>{tr("Statut *")}<select value={assignmentForm.status} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, status: event.target.value }))} required>{ASSIGNMENT_STATUSES.map((status) => <option key={status} value={status}>{tr(teacherStatusLabel(status))}</option>)}</select></label>
            <label>{tr("Rôle")}<input value={assignmentForm.role} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, role: event.target.value }))} placeholder={tr("Professeur principal, intervenant...")} /></label>
            <label className="check-row"><input type="checkbox" checked={assignmentForm.isHomeroomTeacher} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, isHomeroomTeacher: event.target.checked }))} /> {tr("Professeur principal")}</label>
            <label className="form-grid-span-full">{tr("Commentaire")}<input value={assignmentForm.comment} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, comment: event.target.value }))} /></label>
            <div className="actions"><button type="submit">{tr("Créer l'affectation")}</button></div>
          </form>
          <div className="table-wrap">
            <table data-responsive-table="true"><thead><tr><th>{tr("Enseignant")}</th><th>{tr("Matière")}</th><th>{tr("Cursus")}</th><th>{tr("Classe")}</th><th>{tr("Année")}</th><th>{tr("Période")}</th><th>{tr("Charge horaire")}</th><th>{tr("Titulaire")}</th><th>{tr("Statut")}</th><th>{tr("Actions")}</th></tr></thead>
              <tbody>{selectedTeacherAssignments.length === 0 ? <tr><td colSpan={10} className="empty-row">{tr("Aucune affectation enregistrée.")}</td></tr> : selectedTeacherAssignments.map((item) => (
                <tr key={item.id}><td data-label={tr("Enseignant")}>{item.teacherName}</td><td data-label={tr("Matière")}>{item.subjectLabel}</td><td data-label={tr("Cursus")}>{tr(trackLabel(item.track))}</td><td data-label={tr("Classe")}>{item.classLabel}</td><td data-label={tr("Année")}>{item.schoolYearCode}</td><td data-label={tr("Période")}>{item.periodLabel || "-"}</td><td data-label={tr("Charge horaire")}>{item.workloadHours ?? 0} {tr("h")}</td><td data-label={tr("Titulaire")}>{item.isHomeroomTeacher ? tr("Oui") : tr("Non")}</td><td data-label={tr("Statut")}><span className={statusPillClass(item.status)}>{tr(teacherStatusLabel(item.status))}</span></td><td data-label={tr("Actions")}><button type="button" className="button-danger" onClick={() => void archiveResource(`/teachers/assignments/${item.id}`, UI_MESSAGES.deleted, UI_MESSAGES.confirmDelete)}>{tr("Supprimer")}</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeStep === "workloads" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">{tr("Charge pédagogique")}</p><h2>{tr("Synthèse par enseignant")}</h2></div></div>
          <div className="table-wrap">
            <table data-responsive-table="true"><thead><tr><th>{tr("Matricule")}</th><th>{tr("Enseignant")}</th><th>{tr("Affectations")}</th><th>{tr("Total horaire")}</th><th>{tr("Francophone")}</th><th>{tr("Arabophone")}</th><th>{tr("Classes")}</th><th>{tr("Matières")}</th><th>{tr("Statut")}</th></tr></thead>
              <tbody>{workloads.length === 0 ? <tr><td colSpan={9} className="empty-row"><span>{tr("Aucune charge calculée.")}</span><small>{tr("Ajoutez des affectations pour calculer la charge des enseignants.")}</small></td></tr> : workloads.map((item) => (
                <tr key={item.teacherId}><td data-label={tr("Matricule")}>{item.matricule}</td><td data-label={tr("Enseignant")}>{item.teacherName}</td><td data-label={tr("Affectations")}>{item.assignmentsCount}</td><td data-label={tr("Total horaire")}>{item.workloadHoursTotal} {tr("h")}</td><td data-label={tr("Francophone")}>{item.francophoneHoursTotal} {tr("h")}</td><td data-label={tr("Arabophone")}>{item.arabophoneHoursTotal} {tr("h")}</td><td data-label={tr("Classes")}>{item.classes.join(", ") || "-"}</td><td data-label={tr("Matières")}>{item.subjects.join(", ") || "-"}</td><td data-label={tr("Statut")}><span className={statusPillClass(item.status)}>{tr(teacherStatusLabel(item.status))}</span></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeStep === "documents" ? (
        <section className="panel table-panel workflow-section module-modern teachers-panel">
          <div className="table-header"><div><p className="section-kicker">{translate("Dossier administratif")}</p><h2>{translate("Documents administratifs")}</h2></div></div>
          <form className="form-grid module-form teachers-form-grid" onSubmit={submitDocument}>
            <label>{translate("Enseignant *")}<select value={documentForm.teacherId} onChange={(event) => setDocumentForm((prev) => ({ ...prev, teacherId: event.target.value }))} required><option value="">{translate("Choisir")}</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select></label>
            <label>{translate("Type de document *")}<select value={documentForm.documentType} onChange={(event) => setDocumentForm((prev) => ({ ...prev, documentType: event.target.value }))} required>{DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{translateDocumentType(type)}</option>)}</select></label>
            <label>{translate("Nom du document *")}<input value={documentForm.documentName} onChange={(event) => setDocumentForm((prev) => ({ ...prev, documentName: event.target.value }))} required /></label>
            <div className="teacher-file-upload form-grid-span-full">
              <span className="teacher-file-upload__label">{translate("Fichier *")}</span>
              <input
                aria-label={translate("Fichier *")}
                className="teacher-file-upload__input"
                ref={documentFileInputRef}
                type="file"
                accept={TEACHER_DOCUMENT_ACCEPT}
                onChange={handleDocumentFileChange}
                required
              />
              <div className="teacher-file-upload__body">
                <button type="button" className="button-ghost teacher-file-upload__button" onClick={() => documentFileInputRef.current?.click()}>
                  {translate("Choisir un fichier")}
                </button>
                {documentFile ? (
                  <div className="teacher-file-upload__file">
                    <strong>{documentFile.name}</strong>
                    <small>{formatFileSize(documentFile.size)} · {documentFile.type || translate("Type de fichier non renseigné")}</small>
                    <button type="button" className="button-ghost" onClick={clearDocumentFile}>{translate("Retirer le fichier")}</button>
                  </div>
                ) : (
                  <span className="teacher-file-upload__empty">{translate("Aucun fichier sélectionné")}</span>
                )}
              </div>
              <p className="form-help">{translate("Formats acceptés : PDF, images, Word et Excel jusqu'à 10 Mo.")}</p>
              {documentFileError ? <p className="form-error" role="alert">{documentFileError}</p> : null}
            </div>
            <div className="actions">
              <button
                type="submit"
                disabled={
                  documentUploading ||
                  !documentForm.teacherId ||
                  !documentForm.documentType ||
                  !documentForm.documentName.trim() ||
                  !documentFile ||
                  Boolean(documentFileError)
                }
              >
                {documentUploading ? translate("Envoi du document en cours...") : translate("Ajouter le document")}
              </button>
            </div>
          </form>
          <div className="table-wrap">
            <table data-responsive-table="true"><thead><tr><th>{translate("Enseignant")}</th><th>{translate("Type")}</th><th>{translate("Nom du document")}</th><th>{translate("Ajouté le")}</th><th>{translate("Statut")}</th><th>{translate("Actions")}</th></tr></thead>
              <tbody>{selectedTeacherDocuments.length === 0 ? <tr><td colSpan={6} className="empty-row">{translate("Aucun document enregistré.")}</td></tr> : selectedTeacherDocuments.map((document) => (
                <tr key={document.id}><td data-label={translate("Enseignant")}>{document.teacherName}</td><td data-label={translate("Type")}>{translateDocumentType(document.documentType)}</td><td data-label={translate("Nom du document")}><button type="button" className="button-link" onClick={() => void downloadDocument(document)}>{document.documentName || document.originalName}</button></td><td data-label={translate("Ajouté le")}>{new Date(document.uploadedAt).toLocaleDateString(locale)}</td><td data-label={translate("Statut")}><span className={statusPillClass(document.status)}>{translate(teacherStatusLabel(document.status))}</span></td><td data-label={translate("Actions")}><button type="button" className="button-danger" onClick={() => void archiveResource(`/teachers/documents/${document.id}`, UI_MESSAGES.deleted, UI_MESSAGES.confirmDelete)}>{translate("Supprimer")}</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
