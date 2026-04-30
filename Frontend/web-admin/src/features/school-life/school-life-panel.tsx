import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { WorkflowGuide } from "../../shared/components/workflow-guide";
import {
  createAttendance,
  createAttendanceAttachment,
  createBulkAttendance,
  createNotification,
  createTimetableSlot,
  deleteAttendanceAttachment,
  deleteAttendanceById,
  deleteTimetableSlotById,
  dispatchPendingNotifications as dispatchPendingSchoolLifeNotifications,
  fetchAttendance,
  fetchAttendanceAttachments,
  fetchAttendanceSummary,
  fetchNotifications,
  fetchTimetableGrid,
  fetchTimetableReferences,
  fetchTimetableSlots,
  markNotificationSent,
  updateAttendanceValidation
} from "./services/school-life-service";
import type { WorkflowStepDef } from "../../shared/types/app";
import {
  attendanceStatusLabels,
  dayLabels,
  labelFromMap,
  notificationAudienceLabels,
  notificationChannelLabels,
  notificationDeliveryLabels,
  notificationStatusLabels,
  validationStatusLabels
} from "./constants/school-life-labels";
import type {
  AttendanceAttachment,
  AttendanceRecord,
  AttendanceSummary,
  NotificationItem,
  RoomRef,
  SchoolLifePanelProps,
  TeacherAssignmentRef,
  TimetableGrid,
  TimetableSlot
} from "./types/school-life";

export function SchoolLifePanel(props: SchoolLifePanelProps): JSX.Element {
  const {
    api,
    students,
    classes,
    subjects,
    locale,
    onError,
    onNotice,
    focusSection = "all",
    readOnly = false
  } = props;

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
  const [timetableGrid, setTimetableGrid] = useState<TimetableGrid | null>(null);
  const [rooms, setRooms] = useState<RoomRef[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignmentRef[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [attendanceFilters, setAttendanceFilters] = useState({
    classId: "",
    studentId: "",
    status: "",
    fromDate: "",
    toDate: ""
  });
  const [attendanceForm, setAttendanceForm] = useState({
    studentId: "",
    classId: "",
    attendanceDate: new Date().toISOString().slice(0, 10),
    status: "PRESENT",
    reason: ""
  });
  const [bulkAttendanceForm, setBulkAttendanceForm] = useState({
    classId: "",
    attendanceDate: new Date().toISOString().slice(0, 10),
    defaultStatus: "ABSENT",
    reason: "",
    studentIds: [] as string[]
  });

  const [selectedAttendanceId, setSelectedAttendanceId] = useState("");
  const [attendanceAttachments, setAttendanceAttachments] = useState<AttendanceAttachment[]>([]);
  const [attachmentForm, setAttachmentForm] = useState({
    fileName: "",
    fileUrl: "",
    mimeType: "application/pdf"
  });
  const [validationForm, setValidationForm] = useState({
    status: "PENDING" as "PENDING" | "APPROVED" | "REJECTED",
    comment: ""
  });

  const [timetableFilters, setTimetableFilters] = useState({ classId: "", dayOfWeek: "" });
  const [timetableForm, setTimetableForm] = useState({
    classId: "",
    subjectId: "",
    dayOfWeek: "1",
    startTime: "08:00",
    endTime: "09:00",
    roomId: "",
    teacherAssignmentId: ""
  });

  const [notificationFilters, setNotificationFilters] = useState({
    status: "",
    channel: "",
    deliveryStatus: ""
  });
  const [notificationForm, setNotificationForm] = useState({
    studentId: "",
    audienceRole: "PARENT",
    title: "",
    message: "",
    channel: "IN_APP",
    targetAddress: "",
    scheduledAt: ""
  });

  useEffect(() => {
    if (!attendanceForm.studentId && students[0]) {
      setAttendanceForm((prev) => ({ ...prev, studentId: students[0].id }));
    }
    if (!attendanceForm.classId && classes[0]) {
      setAttendanceForm((prev) => ({ ...prev, classId: classes[0].id }));
    }
    if (!bulkAttendanceForm.classId && classes[0]) {
      setBulkAttendanceForm((prev) => ({ ...prev, classId: classes[0].id }));
    }
    if (!timetableForm.classId && classes[0]) {
      setTimetableForm((prev) => ({ ...prev, classId: classes[0].id }));
    }
    if (!timetableForm.subjectId && subjects[0]) {
      setTimetableForm((prev) => ({ ...prev, subjectId: subjects[0].id }));
    }
    if (!notificationForm.studentId && students[0]) {
      setNotificationForm((prev) => ({ ...prev, studentId: students[0].id }));
    }
  }, [
    attendanceForm.classId,
    attendanceForm.studentId,
    bulkAttendanceForm.classId,
    classes,
    notificationForm.studentId,
    students,
    subjects,
    timetableForm.classId,
    timetableForm.subjectId
  ]);

  useEffect(() => {
    if (attendanceRecords.length === 0) {
      if (selectedAttendanceId) {
        setSelectedAttendanceId("");
      }
      setAttendanceAttachments([]);
      setValidationForm({ status: "PENDING", comment: "" });
      return;
    }

    const selected = attendanceRecords.find((item) => item.id === selectedAttendanceId);
    if (selected) {
      setValidationForm({
        status: selected.justificationStatus,
        comment: selected.validationComment || ""
      });
      return;
    }

    setSelectedAttendanceId(attendanceRecords[0].id);
  }, [attendanceRecords, selectedAttendanceId]);

  const loadAttendance = useCallback(
    async (filters = attendanceFilters) => {
      try {
        setAttendanceRecords(await fetchAttendance(api, filters));
      } catch (error) {
        onError(error instanceof Error ? error.message : "Erreur lors du chargement des absences.");
      }
    },
    [api, attendanceFilters, onError]
  );

  const loadAttendanceSummary = useCallback(
    async (filters = attendanceFilters) => {
      try {
        setAttendanceSummary(await fetchAttendanceSummary(api, filters));
      } catch (error) {
        onError(error instanceof Error ? error.message : "Erreur lors du chargement de la synthese des absences.");
      }
    },
    [api, attendanceFilters, onError]
  );
  const loadAttendanceAttachments = useCallback(
    async (attendanceId = selectedAttendanceId) => {
      if (!attendanceId) {
        setAttendanceAttachments([]);
        return;
      }

      try {
        setAttendanceAttachments(await fetchAttendanceAttachments(api, attendanceId));
      } catch (error) {
        onError(error instanceof Error ? error.message : "Erreur lors du chargement des justificatifs.");
      }
    },
    [api, onError, selectedAttendanceId]
  );

  useEffect(() => {
    const needsAttendance =
      focusSection === "all" || focusSection === "overview" || focusSection === "attendance";

    if (!needsAttendance || !selectedAttendanceId) {
      return;
    }

    void loadAttendanceAttachments(selectedAttendanceId);
  }, [focusSection, loadAttendanceAttachments, selectedAttendanceId]);

  const loadTimetableSlots = useCallback(
    async (filters = timetableFilters) => {
      try {
        setTimetableSlots(await fetchTimetableSlots(api, filters));
      } catch (error) {
        onError(error instanceof Error ? error.message : "Erreur lors du chargement de l emploi du temps.");
      }
    },
    [api, onError, timetableFilters]
  );

  const loadTimetableGrid = useCallback(
    async (filters = timetableFilters) => {
      try {
        setTimetableGrid(await fetchTimetableGrid(api, filters));
      } catch (error) {
        onError(error instanceof Error ? error.message : "Erreur lors du chargement de la grille d emploi du temps.");
      }
    },
    [api, onError, timetableFilters]
  );

  const loadTimetableReferences = useCallback(async () => {
    try {
      const references = await fetchTimetableReferences(api);
      setRooms(references.rooms);
      setTeacherAssignments(references.teacherAssignments);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur lors du chargement des references emploi du temps.");
    }
  }, [api, onError]);

  const loadNotifications = useCallback(
    async (filters = notificationFilters) => {
      try {
        setNotifications(await fetchNotifications(api, filters));
      } catch (error) {
        onError(error instanceof Error ? error.message : "Erreur lors du chargement des notifications.");
      }
    },
    [api, notificationFilters, onError]
  );

  useEffect(() => {
    const needsAttendance =
      focusSection === "all" || focusSection === "overview" || focusSection === "attendance";
    const needsTimetable =
      focusSection === "all" || focusSection === "overview" || focusSection === "timetable";
    const needsNotifications =
      focusSection === "all" || focusSection === "overview" || focusSection === "notifications";

    if (needsAttendance) {
      void loadAttendance();
      void loadAttendanceSummary();
    }
    if (needsTimetable) {
      void loadTimetableReferences();
      void loadTimetableSlots();
      void loadTimetableGrid();
    }
    if (needsNotifications) {
      void loadNotifications();
    }
  }, [
    focusSection,
    loadAttendance,
    loadAttendanceSummary,
    loadTimetableReferences,
    loadNotifications,
    loadTimetableGrid,
    loadTimetableSlots
  ]);

  const rejectReadOnly = (): boolean => {
    if (!readOnly) return false;
    onError("Action non autorisee en mode lecture seule.");
    return true;
  };

  const submitAttendance = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (rejectReadOnly()) return;

    let created: AttendanceRecord;
    try {
      created = await createAttendance(api, {
        studentId: attendanceForm.studentId,
        classId: attendanceForm.classId,
        attendanceDate: attendanceForm.attendanceDate,
        status: attendanceForm.status,
        reason: attendanceForm.reason || undefined
      });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur lors de la creation de l absence.");
      return;
    }

    onNotice("Absence enregistree.");
    setAttendanceForm((prev) => ({ ...prev, reason: "" }));
    setSelectedAttendanceId(created.id);
    await loadAttendance(attendanceFilters);
    await loadAttendanceSummary(attendanceFilters);
    await loadNotifications(notificationFilters);
  };

  const deleteAttendance = async (id: string): Promise<void> => {
    if (rejectReadOnly()) return;
    if (!window.confirm("Supprimer cette ligne d'absence ?")) return;
    try {
      await deleteAttendanceById(api, id);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur lors de la suppression de l absence.");
      return;
    }

    onNotice("Absence supprimee.");
    await loadAttendance(attendanceFilters);
    await loadAttendanceSummary(attendanceFilters);
    await loadNotifications(notificationFilters);
  };

  const applyAttendanceFilters = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await loadAttendance(attendanceFilters);
    await loadAttendanceSummary(attendanceFilters);
    await loadNotifications(notificationFilters);
  };

  const resetAttendanceFilters = async (): Promise<void> => {
    const next = { classId: "", studentId: "", status: "", fromDate: "", toDate: "" };
    setAttendanceFilters(next);
    await loadAttendance(next);
    await loadAttendanceSummary(next);
  };

  const submitAttendanceAttachment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (rejectReadOnly()) return;

    if (!selectedAttendanceId) {
      onError("Selectionner une ligne d'absence pour ajouter un justificatif.");
      return;
    }

    const fileName = attachmentForm.fileName.trim();
    const fileUrl = attachmentForm.fileUrl.trim();
    if (!fileName || !fileUrl) {
      onError("Renseigner le nom du fichier et son URL.");
      return;
    }

    try {
      await createAttendanceAttachment(api, selectedAttendanceId, {
        fileName,
        fileUrl,
        mimeType: attachmentForm.mimeType.trim() || undefined
      });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur lors de l ajout du justificatif.");
      return;
    }

    onNotice("Justificatif ajoute.");
    setAttachmentForm((prev) => ({ ...prev, fileName: "", fileUrl: "" }));
    await loadAttendance(attendanceFilters);
    await loadAttendanceAttachments(selectedAttendanceId);
  };

  const removeAttendanceAttachment = async (attachmentId: string): Promise<void> => {
    if (rejectReadOnly()) return;
    if (!selectedAttendanceId) {
      return;
    }

    if (!window.confirm("Supprimer ce justificatif ?")) {
      return;
    }

    try {
      await deleteAttendanceAttachment(api, selectedAttendanceId, attachmentId);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur lors de la suppression du justificatif.");
      return;
    }

    onNotice("Justificatif supprime.");
    await loadAttendance(attendanceFilters);
    await loadAttendanceAttachments(selectedAttendanceId);
  };

  const submitAttendanceValidation = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (rejectReadOnly()) return;

    if (!selectedAttendanceId) {
      onError("Selectionner une ligne d'absence a valider.");
      return;
    }

    let updated: AttendanceRecord;
    try {
      updated = await updateAttendanceValidation(api, selectedAttendanceId, {
        status: validationForm.status,
        comment: validationForm.comment.trim() || undefined
      });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur lors de la validation du justificatif.");
      return;
    }
    setValidationForm({
      status: updated.justificationStatus,
      comment: updated.validationComment || ""
    });
    onNotice("Validation mise a jour.");
    await loadAttendance(attendanceFilters);
    await loadAttendanceSummary(attendanceFilters);
    await loadAttendanceAttachments(selectedAttendanceId);
  };

  const submitBulkAttendance = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (rejectReadOnly()) return;

    if (bulkAttendanceForm.studentIds.length === 0) {
      onError("Selectionner au moins un eleve pour la saisie en masse.");
      return;
    }

    let payload: Awaited<ReturnType<typeof createBulkAttendance>>;
    try {
      payload = await createBulkAttendance(api, {
        classId: bulkAttendanceForm.classId,
        attendanceDate: bulkAttendanceForm.attendanceDate,
        defaultStatus: bulkAttendanceForm.defaultStatus,
        entries: bulkAttendanceForm.studentIds.map((studentId) => ({
          studentId,
          reason: bulkAttendanceForm.reason || undefined
        }))
      });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur lors de la saisie de masse.");
      return;
    }
    onNotice(
      `Saisie de masse terminee: ${payload.createdCount} cree(s), ${payload.updatedCount} maj, ${payload.errorCount} erreur(s).`
    );

    if (payload.errorCount > 0 && payload.errors[0]) {
      onError(`Premier echec: ${payload.errors[0].studentId} - ${payload.errors[0].message}`);
    }

    setBulkAttendanceForm((prev) => ({ ...prev, studentIds: [], reason: "" }));
    await loadAttendance(attendanceFilters);
    await loadAttendanceSummary(attendanceFilters);
    await loadNotifications(notificationFilters);
  };
  const submitTimetableSlot = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (rejectReadOnly()) return;

    try {
      await createTimetableSlot(api, {
        classId: timetableForm.classId,
        subjectId: timetableForm.subjectId,
        dayOfWeek: Number(timetableForm.dayOfWeek),
        startTime: timetableForm.startTime,
        endTime: timetableForm.endTime,
        roomId: timetableForm.roomId || undefined,
        teacherAssignmentId: timetableForm.teacherAssignmentId || undefined
      });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur lors de la creation du cours.");
      return;
    }

    onNotice("Cours ajoute a l'emploi du temps.");
    setTimetableForm((prev) => ({ ...prev, roomId: "", teacherAssignmentId: "" }));
    await loadTimetableSlots(timetableFilters);
    await loadTimetableGrid(timetableFilters);
  };

  const deleteTimetableSlot = async (id: string): Promise<void> => {
    if (rejectReadOnly()) return;
    if (!window.confirm("Supprimer ce cours ?")) return;
    try {
      await deleteTimetableSlotById(api, id);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur lors de la suppression du cours.");
      return;
    }

    onNotice("Cours supprime.");
    await loadTimetableSlots(timetableFilters);
    await loadTimetableGrid(timetableFilters);
  };

  const applyTimetableFilters = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await loadTimetableSlots(timetableFilters);
    await loadTimetableGrid(timetableFilters);
  };

  const resetTimetableFilters = async (): Promise<void> => {
    const next = { classId: "", dayOfWeek: "" };
    setTimetableFilters(next);
    await loadTimetableSlots(next);
    await loadTimetableGrid(next);
  };

  const submitNotification = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (rejectReadOnly()) return;

    try {
      await createNotification(api, {
        studentId: notificationForm.studentId || undefined,
        audienceRole: notificationForm.audienceRole || undefined,
        title: notificationForm.title.trim(),
        message: notificationForm.message.trim(),
        channel: notificationForm.channel,
        targetAddress: notificationForm.targetAddress.trim() || undefined,
        scheduledAt: notificationForm.scheduledAt
          ? new Date(notificationForm.scheduledAt).toISOString()
          : undefined
      });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur lors de la creation de la notification.");
      return;
    }

    onNotice("Notification creee.");
    setNotificationForm((prev) => ({
      ...prev,
      title: "",
      message: "",
      targetAddress: "",
      scheduledAt: ""
    }));
    await loadNotifications(notificationFilters);
  };

  const dispatchPendingNotifications = async (): Promise<void> => {
    if (rejectReadOnly()) return;
    let payload: Awaited<ReturnType<typeof dispatchPendingSchoolLifeNotifications>>;
    try {
      payload = await dispatchPendingSchoolLifeNotifications(api, 150);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur lors de l envoi des notifications.");
      return;
    }
    onNotice(`${payload.dispatchedCount} notification(s) envoyee(s).`);
    await loadNotifications(notificationFilters);
  };
  const markNotificationAsSent = async (id: string): Promise<void> => {
    if (rejectReadOnly()) return;
    try {
      await markNotificationSent(api, id);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur lors de la mise a jour de la notification.");
      return;
    }

    onNotice("Notification marquee comme envoyee.");
    await loadNotifications(notificationFilters);
  };

  const applyNotificationFilters = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await loadNotifications(notificationFilters);
  };

  const resetNotificationFilters = async (): Promise<void> => {
    const next = { status: "", channel: "", deliveryStatus: "" };
    setNotificationFilters(next);
    await loadNotifications(next);
  };

  const attendanceMetrics = useMemo(() => {
    if (attendanceSummary) {
      return {
        total: attendanceSummary.total,
        present: attendanceSummary.byStatus.PRESENT,
        absent: attendanceSummary.byStatus.ABSENT,
        late: attendanceSummary.byStatus.LATE,
        excused: attendanceSummary.byStatus.EXCUSED,
        rate: attendanceSummary.absenceRatePercent
      };
    }

    const total = attendanceRecords.length;
    const present = attendanceRecords.filter((item) => item.status === "PRESENT").length;
    const absent = attendanceRecords.filter((item) => item.status === "ABSENT").length;
    const late = attendanceRecords.filter((item) => item.status === "LATE").length;
    const excused = attendanceRecords.filter((item) => item.status === "EXCUSED").length;
    const rate = total === 0 ? 0 : Number((((absent + late) / total) * 100).toFixed(2));

    return { total, present, absent, late, excused, rate };
  }, [attendanceRecords, attendanceSummary]);

  const topAbsentees = attendanceSummary?.topAbsentees ?? [];
  const selectedAttendance = attendanceRecords.find((item) => item.id === selectedAttendanceId) || null;
  const showOverview = focusSection === "all" || focusSection === "overview";
  const showAttendance = focusSection === "all" || focusSection === "attendance";
  const showTimetable = focusSection === "all" || focusSection === "timetable";
  const showNotifications = focusSection === "all" || focusSection === "notifications";
  const activeRooms = rooms.filter((room) => room.status === "ACTIVE");
  const compatibleTeacherAssignments = teacherAssignments.filter((assignment) => {
    if (assignment.status !== "ACTIVE") return false;
    if (timetableForm.classId && assignment.classId !== timetableForm.classId) return false;
    if (timetableForm.subjectId && assignment.subjectId !== timetableForm.subjectId) return false;
    return true;
  });
  const [attendanceWorkflowStep, setAttendanceWorkflowStep] = useState("absences");
  const [timetableWorkflowStep, setTimetableWorkflowStep] = useState("timetable");
  const [notificationWorkflowStep, setNotificationWorkflowStep] = useState("notifications");
  const attendanceSteps: WorkflowStepDef[] = [
    {
      id: "absences",
      title: "Absences",
      hint: "Saisie individuelle.",
      done: attendanceRecords.length > 0
    },
    {
      id: "bulk",
      title: "Absences - saisie de masse",
      hint: "Pointage par classe."
    },
    {
      id: "journal",
      title: "Journal des absences",
      hint: "Filtrer et verifier les lignes.",
      done: attendanceRecords.length > 0
    },
    {
      id: "validation",
      title: "Justificatifs & validation",
      hint: "Controler les pieces et les statuts.",
      done: attendanceAttachments.length > 0
    }
  ];
  const timetableSteps: WorkflowStepDef[] = [
    {
      id: "timetable",
      title: "Emploi du temps",
      hint: "Composer les creneaux."
    },
    {
      id: "grid",
      title: "Grille d'emploi du temps",
      hint: "Controler la semaine.",
      done: timetableSlots.length > 0
    }
  ];
  const notificationSteps: WorkflowStepDef[] = [
    {
      id: "notifications",
      title: "Notifications",
      hint: "Creer et planifier les messages."
    },
    {
      id: "history",
      title: "Historique notifications",
      hint: "Suivre les envois et relances.",
      done: notifications.length > 0
    }
  ];

  return (
    <div className={`school-life-root focus-${focusSection}${readOnly ? " read-only" : ""}`}>
      {showOverview ? (
      <section className="panel table-panel workflow-section module-modern">
        <div className="headline-row">
          <h2>Pilotage vie scolaire</h2>
        </div>
        <div className="metrics-grid">
          <div className="metric-card"><span>Total pointages</span><strong>{attendanceMetrics.total}</strong></div>
          <div className="metric-card"><span>Presences</span><strong>{attendanceMetrics.present}</strong></div>
          <div className="metric-card"><span>Absences</span><strong>{attendanceMetrics.absent}</strong></div>
          <div className="metric-card"><span>Retards</span><strong>{attendanceMetrics.late}</strong></div>
          <div className="metric-card"><span>Excuses</span><strong>{attendanceMetrics.excused}</strong></div>
          <div className="metric-card"><span>Taux absence+retard</span><strong>{attendanceMetrics.rate}%</strong></div>
        </div>
        <div className="mini-list">
          {topAbsentees.length === 0 ? (
            <div className="mini-item"><span>Aucun cumul d'absences notable sur la periode.</span></div>
          ) : (
            topAbsentees.map((item) => (
              <div key={item.studentId} className="mini-item">
                <span>{item.studentName}</span>
                <strong>{item.absentCount} absence(s)</strong>
              </div>
            ))
          )}
        </div>
      </section>
      ) : null}

      {showAttendance ? (
      <WorkflowGuide
        title="Absences"
        steps={attendanceSteps}
        activeStepId={attendanceWorkflowStep}
        onStepChange={setAttendanceWorkflowStep}
      >
      <section data-step-id="absences" className="panel editor-panel workflow-section module-modern">
        <h2>Absences</h2>
        <p className="section-lead">Saisissez un pointage individuel clair, lisible et rapidement exploitable.</p>
        <form className="form-grid module-form" onSubmit={(event) => void submitAttendance(event)}>
          <label>
            Eleve
            <select value={attendanceForm.studentId} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, studentId: event.target.value }))} required>
              <option value="">Choisir...</option>
              {students.map((item) => (
                <option key={item.id} value={item.id}>{item.matricule} - {item.firstName} {item.lastName}</option>
              ))}
            </select>
          </label>
          <label>
            Classe
            <select value={attendanceForm.classId} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, classId: event.target.value }))} required>
              <option value="">Choisir...</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.code} - {item.label}</option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={attendanceForm.attendanceDate} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, attendanceDate: event.target.value }))} required />
          </label>
          <label>
            Statut
            <select value={attendanceForm.status} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="PRESENT">{labelFromMap(attendanceStatusLabels, "PRESENT")}</option>
              <option value="ABSENT">{labelFromMap(attendanceStatusLabels, "ABSENT")}</option>
              <option value="LATE">{labelFromMap(attendanceStatusLabels, "LATE")}</option>
              <option value="EXCUSED">{labelFromMap(attendanceStatusLabels, "EXCUSED")}</option>
            </select>
          </label>
          <label>
            Motif
            <input value={attendanceForm.reason} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, reason: event.target.value }))} />
          </label>
          <button type="submit">Enregistrer</button>
        </form>
      </section>

      <section data-step-id="bulk" className="panel editor-panel workflow-section module-modern">
        <h2>Absences - saisie de masse</h2>
        <p className="section-lead">Traitez une classe complete sans perdre la lisibilite du journal des absences.</p>
        <form className="form-grid module-form" onSubmit={(event) => void submitBulkAttendance(event)}>
          <div className="split-grid">
            <label>Classe<select value={bulkAttendanceForm.classId} onChange={(event) => setBulkAttendanceForm((prev) => ({ ...prev, classId: event.target.value }))} required><option value="">Choisir...</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.label}</option>)}</select></label>
            <label>Date<input type="date" value={bulkAttendanceForm.attendanceDate} onChange={(event) => setBulkAttendanceForm((prev) => ({ ...prev, attendanceDate: event.target.value }))} required /></label>
            <label>Statut<select value={bulkAttendanceForm.defaultStatus} onChange={(event) => setBulkAttendanceForm((prev) => ({ ...prev, defaultStatus: event.target.value }))}><option value="PRESENT">{labelFromMap(attendanceStatusLabels, "PRESENT")}</option><option value="ABSENT">{labelFromMap(attendanceStatusLabels, "ABSENT")}</option><option value="LATE">{labelFromMap(attendanceStatusLabels, "LATE")}</option><option value="EXCUSED">{labelFromMap(attendanceStatusLabels, "EXCUSED")}</option></select></label>
            <label>Motif global<input value={bulkAttendanceForm.reason} onChange={(event) => setBulkAttendanceForm((prev) => ({ ...prev, reason: event.target.value }))} /></label>
          </div>
          <label>
            Eleves concernes
            <select
              multiple
              className="multi-select"
              value={bulkAttendanceForm.studentIds}
              onChange={(event) => {
                const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
                setBulkAttendanceForm((prev) => ({ ...prev, studentIds: selected }));
              }}
              required
            >
              {students.map((item) => (
                <option key={item.id} value={item.id}>{item.matricule} - {item.firstName} {item.lastName}</option>
              ))}
            </select>
          </label>
          <p className="subtle hint">Ctrl/Cmd + clic pour multi-selection.</p>
          <button type="submit">Enregistrer en masse</button>
        </form>
      </section>
      <section data-step-id="journal" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <h2>Journal des absences</h2>
          <span className="subtle">Filtre rapide, puis actions sur chaque ligne.</span>
        </div>
        <form className="filter-grid module-filter" onSubmit={(event) => void applyAttendanceFilters(event)}>
          <label>Classe<select value={attendanceFilters.classId} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, classId: event.target.value }))}><option value="">Toutes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
          <label>Eleve<select value={attendanceFilters.studentId} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, studentId: event.target.value }))}><option value="">Tous</option>{students.map((item) => <option key={item.id} value={item.id}>{item.matricule}</option>)}</select></label>
          <label>Statut<select value={attendanceFilters.status} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="">Tous</option><option value="PRESENT">{labelFromMap(attendanceStatusLabels, "PRESENT")}</option><option value="ABSENT">{labelFromMap(attendanceStatusLabels, "ABSENT")}</option><option value="LATE">{labelFromMap(attendanceStatusLabels, "LATE")}</option><option value="EXCUSED">{labelFromMap(attendanceStatusLabels, "EXCUSED")}</option></select></label>
          <label>Du<input type="date" value={attendanceFilters.fromDate} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, fromDate: event.target.value }))} /></label>
          <label>Au<input type="date" value={attendanceFilters.toDate} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, toDate: event.target.value }))} /></label>
          <div className="actions"><button type="submit">Filtrer</button><button type="button" className="button-ghost" onClick={() => void resetAttendanceFilters()}>Reinitialiser</button></div>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Eleve</th><th>Classe</th><th>Statut</th><th>Justif.</th><th>Validation</th><th>Pieces</th><th>Motif</th><th>Action</th></tr>
            </thead>
            <tbody>
              {attendanceRecords.length === 0 ? (
                <tr><td colSpan={9} className="empty-row">Aucune ligne.</td></tr>
              ) : (
                attendanceRecords.map((item) => (
                  <tr key={item.id}>
                    <td>{item.attendanceDate}</td>
                    <td>{item.studentName || "-"}</td>
                    <td>{item.classLabel || "-"}</td>
                    <td>{labelFromMap(attendanceStatusLabels, item.status)}</td>
                    <td>{labelFromMap(validationStatusLabels, item.justificationStatus)}</td>
                    <td>
                      {item.validatedAt
                        ? `${new Date(item.validatedAt).toLocaleString(locale)}${item.validationComment ? ` | ${item.validationComment}` : ""}`
                        : item.validationComment || "-"}
                    </td>
                    <td>{item.attachments?.length ?? 0}</td>
                    <td>{item.reason || "-"}</td>
                    <td><button type="button" className="button-danger" onClick={() => void deleteAttendance(item.id)}>Supprimer</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section data-step-id="validation" className="panel editor-panel workflow-section module-modern">
        <h2>Justificatifs & validation</h2>
        <p className="section-lead">Centralisez validation et pieces justificatives sans ouvrir plusieurs ecrans.</p>
        <h3>Validation</h3>
        <form className="form-grid module-form" onSubmit={(event) => void submitAttendanceValidation(event)}>
          <div className="split-grid">
            <label>
              Pointage cible
              <select value={selectedAttendanceId} onChange={(event) => setSelectedAttendanceId(event.target.value)}>
                <option value="">Choisir...</option>
                {attendanceRecords.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.attendanceDate} - {item.studentName || item.studentId} ({item.status})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Statut justification
              <select
                value={validationForm.status}
                onChange={(event) =>
                  setValidationForm((prev) => ({
                    ...prev,
                    status: event.target.value as "PENDING" | "APPROVED" | "REJECTED"
                  }))
                }
                disabled={!selectedAttendanceId}
              >
                <option value="PENDING">{labelFromMap(validationStatusLabels, "PENDING")}</option>
                <option value="APPROVED">{labelFromMap(validationStatusLabels, "APPROVED")}</option>
                <option value="REJECTED">{labelFromMap(validationStatusLabels, "REJECTED")}</option>
              </select>
            </label>
            <label>
              Commentaire validation
              <input
                value={validationForm.comment}
                onChange={(event) =>
                  setValidationForm((prev) => ({ ...prev, comment: event.target.value }))
                }
                disabled={!selectedAttendanceId}
              />
            </label>
          </div>
          <div className="actions">
            <button type="submit" disabled={!selectedAttendanceId}>Enregistrer validation</button>
          </div>
        </form>

        <h3>Ajout de justificatif</h3>
        <form className="form-grid module-form" onSubmit={(event) => void submitAttendanceAttachment(event)}>
          <div className="split-grid">
            <label>
              Nom du fichier
              <input
                value={attachmentForm.fileName}
                onChange={(event) =>
                  setAttachmentForm((prev) => ({ ...prev, fileName: event.target.value }))
                }
                disabled={!selectedAttendanceId}
              />
            </label>
            <label>
              URL du justificatif
              <input
                value={attachmentForm.fileUrl}
                onChange={(event) =>
                  setAttachmentForm((prev) => ({ ...prev, fileUrl: event.target.value }))
                }
                disabled={!selectedAttendanceId}
              />
            </label>
            <label>
              MIME type
              <input
                value={attachmentForm.mimeType}
                onChange={(event) =>
                  setAttachmentForm((prev) => ({ ...prev, mimeType: event.target.value }))
                }
                disabled={!selectedAttendanceId}
              />
            </label>
          </div>
          <div className="actions">
            <button type="submit" disabled={!selectedAttendanceId}>Ajouter justificatif</button>
          </div>
        </form>

        <h3>Liste des justificatifs</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fichier</th><th>MIME</th><th>Ajoute le</th><th>Action</th></tr>
            </thead>
            <tbody>
              {!selectedAttendanceId ? (
                <tr><td colSpan={4} className="empty-row">Selectionner une absence.</td></tr>
              ) : attendanceAttachments.length === 0 ? (
                <tr><td colSpan={4} className="empty-row">Aucun justificatif.</td></tr>
              ) : (
                attendanceAttachments.map((item) => (
                  <tr key={item.id}>
                    <td><a href={item.fileUrl} target="_blank" rel="noreferrer">{item.fileName}</a></td>
                    <td>{item.mimeType || "-"}</td>
                    <td>{new Date(item.createdAt).toLocaleString(locale)}</td>
                    <td><button type="button" className="button-danger" onClick={() => void removeAttendanceAttachment(item.id)}>Supprimer</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selectedAttendance ? (
          <p className="subtle">Selection active: {selectedAttendance.studentName || selectedAttendance.studentId} - {selectedAttendance.attendanceDate}</p>
        ) : null}
      </section>
      </WorkflowGuide>
      ) : null}

      {showTimetable ? (
      <WorkflowGuide
        title="Emploi du temps"
        steps={timetableSteps}
        activeStepId={timetableWorkflowStep}
        onStepChange={setTimetableWorkflowStep}
      >
      <section data-step-id="timetable" className="panel editor-panel workflow-section module-modern">
        <h2>Emploi du temps</h2>
        <p className="section-lead">Composez des creneaux lisibles puis controlez la semaine complete en un seul coup d'oeil.</p>
        <form className="form-grid module-form" onSubmit={(event) => void submitTimetableSlot(event)}>
          <label>Classe<select value={timetableForm.classId} onChange={(event) => setTimetableForm((prev) => ({ ...prev, classId: event.target.value }))} required>{classes.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.label}</option>)}</select></label>
          <label>Matiere<select value={timetableForm.subjectId} onChange={(event) => setTimetableForm((prev) => ({ ...prev, subjectId: event.target.value }))} required>{subjects.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.label}</option>)}</select></label>
          <label>Jour<select value={timetableForm.dayOfWeek} onChange={(event) => setTimetableForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}>{[1,2,3,4,5,6,7].map((day) => <option key={day} value={String(day)}>{dayLabels.get(day)}</option>)}</select></label>
          <label>Debut<input type="time" value={timetableForm.startTime} onChange={(event) => setTimetableForm((prev) => ({ ...prev, startTime: event.target.value }))} required /></label>
          <label>Fin<input type="time" value={timetableForm.endTime} onChange={(event) => setTimetableForm((prev) => ({ ...prev, endTime: event.target.value }))} required /></label>
          <label>Salle<select value={timetableForm.roomId} onChange={(event) => setTimetableForm((prev) => ({ ...prev, roomId: event.target.value }))}><option value="">Non definie</option>{activeRooms.map((room) => <option key={room.id} value={room.id}>{room.code} - {room.name}</option>)}</select></label>
          <label>Enseignant<select value={timetableForm.teacherAssignmentId} onChange={(event) => setTimetableForm((prev) => ({ ...prev, teacherAssignmentId: event.target.value }))}><option value="">Non defini</option>{compatibleTeacherAssignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.teacherName || "Enseignant"} - {assignment.subjectLabel || "Matiere"} - {assignment.classLabel || "Classe"}</option>)}</select></label>
          <button type="submit">Ajouter</button>
        </form>
      </section>

      <section data-step-id="grid" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <h2>Grille d'emploi du temps</h2>
          <span className="subtle">Recherche par classe et par jour.</span>
        </div>
        <form className="filter-grid module-filter" onSubmit={(event) => void applyTimetableFilters(event)}>
          <label>Classe<select value={timetableFilters.classId} onChange={(event) => setTimetableFilters((prev) => ({ ...prev, classId: event.target.value }))}><option value="">Toutes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
          <label>Jour<select value={timetableFilters.dayOfWeek} onChange={(event) => setTimetableFilters((prev) => ({ ...prev, dayOfWeek: event.target.value }))}><option value="">Tous</option>{[1,2,3,4,5,6,7].map((day) => <option key={day} value={String(day)}>{dayLabels.get(day)}</option>)}</select></label>
          <div className="actions"><button type="submit">Filtrer</button><button type="button" className="button-ghost" onClick={() => void resetTimetableFilters()}>Reinitialiser</button></div>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Jour</th><th>Heure</th><th>Classe</th><th>Matiere</th><th>Salle</th><th>Enseignant</th><th>Action</th></tr>
            </thead>
            <tbody>
              {timetableSlots.length === 0 ? (
                <tr><td colSpan={7} className="empty-row">Aucun cours.</td></tr>
              ) : (
                timetableSlots.map((item) => (
                  <tr key={item.id}>
                    <td>{dayLabels.get(item.dayOfWeek) || item.dayOfWeek}</td>
                    <td>{item.startTime} - {item.endTime}</td>
                    <td>{item.classLabel || "-"}</td>
                    <td>{item.subjectLabel || "-"}</td>
                    <td>{item.room || "-"}</td>
                    <td>{item.teacherName || "-"}</td>
                    <td><button type="button" className="button-danger" onClick={() => void deleteTimetableSlot(item.id)}>Supprimer</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <h3>Vue hebdo</h3>
        <div className="day-grid">
          {(timetableGrid?.days || []).map((day) => (
            <article key={day.dayOfWeek} className="day-card">
              <h4>{day.dayLabel}</h4>
              {day.slots.length === 0 ? (
                <p className="subtle">Aucun cours</p>
              ) : (
                <div className="mini-list">
                  {day.slots.map((slot) => (
                    <div key={slot.id} className="slot-chip">
                      <strong>{slot.startTime} - {slot.endTime}</strong>
                      <span>{slot.subjectLabel || "-"}</span>
                      <small>{slot.classLabel || "-"} {slot.room ? `| ${slot.room}` : ""}</small>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
      </WorkflowGuide>
      ) : null}

      {showNotifications ? (
      <WorkflowGuide
        title="Notifications"
        steps={notificationSteps}
        activeStepId={notificationWorkflowStep}
        onStepChange={setNotificationWorkflowStep}
      >
      <section data-step-id="notifications" className="panel editor-panel workflow-section module-modern">
        <div className="headline-row">
          <h2>Notifications</h2>
          <div className="inline-actions">
            <button type="button" className="button-ghost" onClick={() => void dispatchPendingNotifications()}>
              Envoyer les notifications en attente
            </button>
          </div>
        </div>
        <p className="section-lead">Programmez les messages importants avec un flux plus propre pour les equipes.</p>
        <form className="form-grid module-form" onSubmit={(event) => void submitNotification(event)}>
          <label>Titre<input value={notificationForm.title} onChange={(event) => setNotificationForm((prev) => ({ ...prev, title: event.target.value }))} required /></label>
          <label>Message<input value={notificationForm.message} onChange={(event) => setNotificationForm((prev) => ({ ...prev, message: event.target.value }))} required /></label>
          <label>Audience<select value={notificationForm.audienceRole} onChange={(event) => setNotificationForm((prev) => ({ ...prev, audienceRole: event.target.value }))}><option value="">Aucun</option><option value="PARENT">{labelFromMap(notificationAudienceLabels, "PARENT")}</option><option value="ENSEIGNANT">{labelFromMap(notificationAudienceLabels, "ENSEIGNANT")}</option><option value="SCOLARITE">{labelFromMap(notificationAudienceLabels, "SCOLARITE")}</option><option value="COMPTABLE">{labelFromMap(notificationAudienceLabels, "COMPTABLE")}</option></select></label>
          <label>Eleve<select value={notificationForm.studentId} onChange={(event) => setNotificationForm((prev) => ({ ...prev, studentId: event.target.value }))}><option value="">Aucun</option>{students.map((item) => <option key={item.id} value={item.id}>{item.matricule} - {item.firstName} {item.lastName}</option>)}</select></label>
          <label>Canal<select value={notificationForm.channel} onChange={(event) => setNotificationForm((prev) => ({ ...prev, channel: event.target.value }))}><option value="IN_APP">{labelFromMap(notificationChannelLabels, "IN_APP")}</option><option value="EMAIL">{labelFromMap(notificationChannelLabels, "EMAIL")}</option><option value="SMS">{labelFromMap(notificationChannelLabels, "SMS")}</option></select></label>
          <label>Cible explicite<input value={notificationForm.targetAddress} onChange={(event) => setNotificationForm((prev) => ({ ...prev, targetAddress: event.target.value }))} placeholder="email@exemple.com ou +2250707070707" /></label>
          <label>Planifiee<input type="datetime-local" value={notificationForm.scheduledAt} onChange={(event) => setNotificationForm((prev) => ({ ...prev, scheduledAt: event.target.value }))} /></label>
          <button type="submit">Programmer l'envoi</button>
        </form>
      </section>

      <section data-step-id="history" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <h2>Historique notifications</h2>
          <span className="subtle">Suivi des envois, statuts et relances.</span>
        </div>
        <form className="filter-grid module-filter" onSubmit={(event) => void applyNotificationFilters(event)}>
          <label>Statut<select value={notificationFilters.status} onChange={(event) => setNotificationFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="">Tous</option><option value="PENDING">{labelFromMap(notificationStatusLabels, "PENDING")}</option><option value="SCHEDULED">{labelFromMap(notificationStatusLabels, "SCHEDULED")}</option><option value="SENT">{labelFromMap(notificationStatusLabels, "SENT")}</option><option value="FAILED">{labelFromMap(notificationStatusLabels, "FAILED")}</option></select></label>
          <label>Canal<select value={notificationFilters.channel} onChange={(event) => setNotificationFilters((prev) => ({ ...prev, channel: event.target.value }))}><option value="">Tous</option><option value="IN_APP">{labelFromMap(notificationChannelLabels, "IN_APP")}</option><option value="EMAIL">{labelFromMap(notificationChannelLabels, "EMAIL")}</option><option value="SMS">{labelFromMap(notificationChannelLabels, "SMS")}</option></select></label>
          <label>Distribution<select value={notificationFilters.deliveryStatus} onChange={(event) => setNotificationFilters((prev) => ({ ...prev, deliveryStatus: event.target.value }))}><option value="">Toutes</option><option value="QUEUED">{labelFromMap(notificationDeliveryLabels, "QUEUED")}</option><option value="SENT_TO_PROVIDER">{labelFromMap(notificationDeliveryLabels, "SENT_TO_PROVIDER")}</option><option value="DELIVERED">{labelFromMap(notificationDeliveryLabels, "DELIVERED")}</option><option value="RETRYING">{labelFromMap(notificationDeliveryLabels, "RETRYING")}</option><option value="FAILED">{labelFromMap(notificationDeliveryLabels, "FAILED")}</option><option value="UNDELIVERABLE">{labelFromMap(notificationDeliveryLabels, "UNDELIVERABLE")}</option></select></label>
          <div className="actions"><button type="submit">Filtrer</button><button type="button" className="button-ghost" onClick={() => void resetNotificationFilters()}>Reinitialiser</button></div>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Titre</th><th>Canal</th><th>Statut</th><th>Distribution</th><th>Cible</th><th>Fournisseur</th><th>Tentatives</th><th>Planifiee</th><th>Envoyee</th><th>Action</th></tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr><td colSpan={10} className="empty-row">Aucune notification.</td></tr>
              ) : (
                notifications.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{labelFromMap(notificationChannelLabels, item.channel)}</td>
                    <td>{labelFromMap(notificationStatusLabels, item.status)}</td>
                    <td>{labelFromMap(notificationDeliveryLabels, item.deliveryStatus)}</td>
                    <td>{item.targetAddress || item.studentName || labelFromMap(notificationAudienceLabels, item.audienceRole) || "-"}</td>
                    <td>{item.provider || "-"}</td>
                    <td>{item.attempts}</td>
                    <td>{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString(locale) : "-"}</td>
                    <td>{item.sentAt ? new Date(item.sentAt).toLocaleString(locale) : item.nextAttemptAt ? `Nouvelle tentative ${new Date(item.nextAttemptAt).toLocaleString(locale)}` : "-"}</td>
                    <td>{item.status !== "SENT" ? <button type="button" className="button-ghost" onClick={() => void markNotificationAsSent(item.id)}>Marquer comme envoyee</button> : null}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      </WorkflowGuide>
      ) : null}
    </div>
  );
}
