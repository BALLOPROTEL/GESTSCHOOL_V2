import { FormEvent, useCallback, useEffect, useState } from "react";

import { WorkflowGuide } from "../../shared/components/workflow-guide";
import { ResponsiveForm } from "../../shared/components/responsive-form";
import { useConfirmDialog } from "../../shared/components/confirm-dialog";
import { translateUiMessage, UI_MESSAGES } from "../../shared/i18n";
import { toUiErrorMessage } from "../../shared/services/api-errors";
import {
  createAttendance,
  createAttendanceAttachment,
  createBulkAttendance,
  createNotification,
  createTimetableSlot,
  deleteAttendanceAttachment,
  deleteAttendanceById,
  deleteTimetableSlotById,
  downloadAttendanceAttachment,
  dispatchPendingNotifications as dispatchPendingSchoolLifeNotifications,
  fetchAttendance,
  fetchAttendanceAttachments,
  fetchNotifications,
  fetchTimetableGrid,
  fetchTimetableReferences,
  fetchTimetableSlots,
  cancelNotification,
  replayNotification,
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
  NotificationItem,
  RoomRef,
  SchoolLifePanelProps,
  TeacherAssignmentRef,
  TimetableGrid,
  TimetableSlot
} from "./types/school-life";
import { useI18n } from "../../shared/i18n-context";


type LoadWarningKey = "attendance" | "attachments" | "timetable" | "notifications";

type LoadOptions = {
  notify?: boolean;
};

type RowAction = {
  danger?: boolean;
  label: string;
  onSelect: () => void;
};

export function SchoolLifePanel(props: SchoolLifePanelProps): JSX.Element {
  const { language, t: tr } = useI18n();
  const confirmAction = useConfirmDialog();
  const {
    api,
    students,
    classes,
    subjects,
    locale,
    onError,
    onNotice,
    focusSection = "attendance",
    readOnly = false
  } = props;

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
  const [timetableGrid, setTimetableGrid] = useState<TimetableGrid | null>(null);
  const [rooms, setRooms] = useState<RoomRef[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignmentRef[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadWarnings, setLoadWarnings] = useState<Record<LoadWarningKey, string | null>>({
    attendance: null,
    attachments: null,
    timetable: null,
    notifications: null
  });

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
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
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
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const clearLoadWarning = useCallback((key: LoadWarningKey) => {
    setLoadWarnings((prev) => (prev[key] ? { ...prev, [key]: null } : prev));
  }, []);

  const rememberLoadWarning = useCallback((key: LoadWarningKey, message: string) => {
    setLoadWarnings((prev) => ({ ...prev, [key]: message }));
  }, []);

  const renderLoadWarning = (key: LoadWarningKey, label: string): JSX.Element | null =>
    loadWarnings[key] ? (
      <div className="notice-card notice-info" role="status">
        <strong>{label}</strong>
        <p>{tr("Les donnees sont temporairement indisponibles. Vous pouvez continuer a consulter l'ecran puis reessayer.")}</p>
      </div>
    ) : null;

  const renderActionMenu = (id: string, label: string, actions: RowAction[]): JSX.Element => (
    <div className="v3-action-cell">
      <button
        type="button"
        className="v3-more-button"
        aria-label={label}
        aria-expanded={openActionMenuId === id}
        onClick={() => setOpenActionMenuId((current) => (current === id ? null : id))}
      >
        <span aria-hidden="true">...</span>
      </button>
      {openActionMenuId === id ? (
        <div className="v3-action-menu" role="menu">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              className={action.danger ? "is-danger" : undefined}
              onClick={() => {
                setOpenActionMenuId(null);
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

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
    async (filters = attendanceFilters, options: LoadOptions = {}) => {
      try {
        setAttendanceRecords(await fetchAttendance(api, filters));
        clearLoadWarning("attendance");
      } catch (error) {
        const message = toUiErrorMessage(error, UI_MESSAGES.loadError);
        setAttendanceRecords([]);
        rememberLoadWarning("attendance", message);
        if (options.notify) onError(message);
      }
    },
    [api, attendanceFilters, clearLoadWarning, onError, rememberLoadWarning]
  );

  const loadAttendanceAttachments = useCallback(
    async (attendanceId = selectedAttendanceId, options: LoadOptions = {}) => {
      if (!attendanceId) {
        setAttendanceAttachments([]);
        return;
      }

      try {
        setAttendanceAttachments(await fetchAttendanceAttachments(api, attendanceId));
        clearLoadWarning("attachments");
      } catch (error) {
        const message = toUiErrorMessage(error, UI_MESSAGES.loadError);
        setAttendanceAttachments([]);
        rememberLoadWarning("attachments", message);
        if (options.notify) onError(message);
      }
    },
    [api, clearLoadWarning, onError, rememberLoadWarning, selectedAttendanceId]
  );

  useEffect(() => {
    const needsAttendance = focusSection === "attendance";

    if (!needsAttendance || !selectedAttendanceId) {
      return;
    }

    void loadAttendanceAttachments(selectedAttendanceId);
  }, [focusSection, loadAttendanceAttachments, selectedAttendanceId]);

  const loadTimetableSlots = useCallback(
    async (filters = timetableFilters, options: LoadOptions = {}) => {
      try {
        setTimetableSlots(await fetchTimetableSlots(api, filters));
        clearLoadWarning("timetable");
      } catch (error) {
        const message = toUiErrorMessage(error, UI_MESSAGES.loadError);
        setTimetableSlots([]);
        rememberLoadWarning("timetable", message);
        if (options.notify) onError(message);
      }
    },
    [api, clearLoadWarning, onError, rememberLoadWarning, timetableFilters]
  );

  const loadTimetableGrid = useCallback(
    async (filters = timetableFilters, options: LoadOptions = {}) => {
      try {
        setTimetableGrid(await fetchTimetableGrid(api, filters));
        clearLoadWarning("timetable");
      } catch (error) {
        const message = toUiErrorMessage(error, UI_MESSAGES.loadError);
        setTimetableGrid(null);
        rememberLoadWarning("timetable", message);
        if (options.notify) onError(message);
      }
    },
    [api, clearLoadWarning, onError, rememberLoadWarning, timetableFilters]
  );

  const loadTimetableReferences = useCallback(async (options: LoadOptions = {}) => {
    try {
      const references = await fetchTimetableReferences(api);
      setRooms(references.rooms);
      setTeacherAssignments(references.teacherAssignments);
      clearLoadWarning("timetable");
    } catch (error) {
      const message = toUiErrorMessage(error, UI_MESSAGES.loadError);
      setRooms([]);
      setTeacherAssignments([]);
      rememberLoadWarning("timetable", message);
      if (options.notify) onError(message);
    }
  }, [api, clearLoadWarning, onError, rememberLoadWarning]);

  const loadNotifications = useCallback(
    async (filters = notificationFilters, options: LoadOptions = {}) => {
      try {
        setNotifications(await fetchNotifications(api, filters));
        clearLoadWarning("notifications");
      } catch (error) {
        const message = toUiErrorMessage(error, UI_MESSAGES.loadError);
        setNotifications([]);
        rememberLoadWarning("notifications", message);
        if (options.notify) onError(message);
      }
    },
    [api, clearLoadWarning, notificationFilters, onError, rememberLoadWarning]
  );

  useEffect(() => {
    const needsAttendance = focusSection === "attendance";
    const needsTimetable = focusSection === "timetable";
    const needsNotifications = focusSection === "notifications";

    if (needsAttendance) {
      void loadAttendance();
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
    loadTimetableReferences,
    loadNotifications,
    loadTimetableGrid,
    loadTimetableSlots
  ]);

  const rejectReadOnly = (): boolean => {
    if (!readOnly) return false;
    onError(UI_MESSAGES.readOnly);
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
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }

    onNotice(UI_MESSAGES.absenceSaved);
    setAttendanceForm((prev) => ({ ...prev, reason: "" }));
    setSelectedAttendanceId(created.id);
    await loadAttendance(attendanceFilters, { notify: true });
    await loadNotifications(notificationFilters, { notify: true });
  };

  const deleteAttendance = async (id: string): Promise<void> => {
    if (rejectReadOnly()) return;
    const accepted = await confirmAction({
      description: tr(UI_MESSAGES.absenceDeleteConfirm),
      confirmLabel: tr("Supprimer"),
      tone: "danger"
    });
    if (!accepted) return;
    try {
      await deleteAttendanceById(api, id);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.deleteError));
      return;
    }

    onNotice(UI_MESSAGES.absenceDeleted);
    await loadAttendance(attendanceFilters, { notify: true });
    await loadNotifications(notificationFilters, { notify: true });
  };

  const applyAttendanceFilters = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await loadAttendance(attendanceFilters, { notify: true });
    await loadNotifications(notificationFilters, { notify: true });
  };

  const resetAttendanceFilters = async (): Promise<void> => {
    const next = { classId: "", studentId: "", status: "", fromDate: "", toDate: "" };
    setAttendanceFilters(next);
    await loadAttendance(next, { notify: true });
  };

  const submitAttendanceAttachment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    onError(null);
    if (rejectReadOnly()) return;

    if (!selectedAttendanceId) {
      onError(UI_MESSAGES.selectAbsence);
      return;
    }

    if (!attachmentFile) {
      onError(UI_MESSAGES.selectFile);
      return;
    }

    try {
      await createAttendanceAttachment(api, selectedAttendanceId, attachmentFile);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.uploadError));
      return;
    }

    onNotice(UI_MESSAGES.attachmentSaved);
    setAttachmentFile(null);
    form.reset();
    await loadAttendance(attendanceFilters, { notify: true });
    await loadAttendanceAttachments(selectedAttendanceId, { notify: true });
  };

  const removeAttendanceAttachment = async (attachmentId: string): Promise<void> => {
    if (rejectReadOnly()) return;
    if (!selectedAttendanceId) {
      return;
    }

    const accepted = await confirmAction({
      description: tr(UI_MESSAGES.attachmentDeleteConfirm),
      confirmLabel: tr("Supprimer"),
      tone: "danger"
    });
    if (!accepted) {
      return;
    }

    try {
      await deleteAttendanceAttachment(api, selectedAttendanceId, attachmentId);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.deleteError));
      return;
    }

    onNotice(UI_MESSAGES.attachmentDeleted);
    await loadAttendance(attendanceFilters, { notify: true });
    await loadAttendanceAttachments(selectedAttendanceId, { notify: true });
  };

  const downloadAttachment = async (attachment: AttendanceAttachment): Promise<void> => {
    if (!selectedAttendanceId) return;
    try {
      await downloadAttendanceAttachment(api, selectedAttendanceId, attachment);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.downloadError));
    }
  };

  const submitAttendanceValidation = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (rejectReadOnly()) return;

    if (!selectedAttendanceId) {
      onError(UI_MESSAGES.selectAbsence);
      return;
    }

    let updated: AttendanceRecord;
    try {
      updated = await updateAttendanceValidation(api, selectedAttendanceId, {
        status: validationForm.status,
        comment: validationForm.comment.trim() || undefined
      });
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }
    setValidationForm({
      status: updated.justificationStatus,
      comment: updated.validationComment || ""
    });
    onNotice(UI_MESSAGES.validationUpdated);
    await loadAttendance(attendanceFilters, { notify: true });
    await loadAttendanceAttachments(selectedAttendanceId, { notify: true });
  };

  const submitBulkAttendance = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (rejectReadOnly()) return;

    if (bulkAttendanceForm.studentIds.length === 0) {
      onError(UI_MESSAGES.selectStudent);
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
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }
    onNotice(translateUiMessage(language, UI_MESSAGES.bulkAttendanceCompleted, {
      created: payload.createdCount,
      updated: payload.updatedCount,
      errors: payload.errorCount
    }));

    if (payload.errorCount > 0 && payload.errors[0]) {
      onError(UI_MESSAGES.bulkAttendanceHasErrors);
    }

    setBulkAttendanceForm((prev) => ({ ...prev, studentIds: [], reason: "" }));
    await loadAttendance(attendanceFilters, { notify: true });
    await loadNotifications(notificationFilters, { notify: true });
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
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }

    onNotice(UI_MESSAGES.lessonSaved);
    setTimetableForm((prev) => ({ ...prev, roomId: "", teacherAssignmentId: "" }));
    await loadTimetableSlots(timetableFilters, { notify: true });
    await loadTimetableGrid(timetableFilters, { notify: true });
  };

  const deleteTimetableSlot = async (id: string): Promise<void> => {
    if (rejectReadOnly()) return;
    const accepted = await confirmAction({
      description: tr(UI_MESSAGES.lessonDeleteConfirm),
      confirmLabel: tr("Supprimer"),
      tone: "danger"
    });
    if (!accepted) return;
    try {
      await deleteTimetableSlotById(api, id);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.deleteError));
      return;
    }

    onNotice(UI_MESSAGES.lessonDeleted);
    await loadTimetableSlots(timetableFilters, { notify: true });
    await loadTimetableGrid(timetableFilters, { notify: true });
  };

  const applyTimetableFilters = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await loadTimetableSlots(timetableFilters, { notify: true });
    await loadTimetableGrid(timetableFilters, { notify: true });
  };

  const resetTimetableFilters = async (): Promise<void> => {
    const next = { classId: "", dayOfWeek: "" };
    setTimetableFilters(next);
    await loadTimetableSlots(next, { notify: true });
    await loadTimetableGrid(next, { notify: true });
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
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }

    onNotice(UI_MESSAGES.notificationCreated);
    setNotificationForm((prev) => ({
      ...prev,
      title: "",
      message: "",
      targetAddress: "",
      scheduledAt: ""
    }));
    await loadNotifications(notificationFilters, { notify: true });
  };

  const dispatchPendingNotifications = async (): Promise<void> => {
    if (rejectReadOnly()) return;
    let payload: Awaited<ReturnType<typeof dispatchPendingSchoolLifeNotifications>>;
    try {
      payload = await dispatchPendingSchoolLifeNotifications(api, 150);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }
    onNotice(translateUiMessage(language, UI_MESSAGES.notificationsDispatched, { count: payload.dispatchedCount }));
    await loadNotifications(notificationFilters, { notify: true });
  };
  const cancelPendingNotification = async (id: string): Promise<void> => {
    if (rejectReadOnly()) return;
    try {
      await cancelNotification(api, id);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }

    onNotice(UI_MESSAGES.notificationCancelled);
    await loadNotifications(notificationFilters, { notify: true });
  };
  const replayFailedNotification = async (id: string): Promise<void> => {
    if (rejectReadOnly()) return;
    const reason = window.prompt(tr(UI_MESSAGES.replayReasonPrompt))?.trim();
    if (!reason) return;
    try {
      await replayNotification(api, id, reason);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
      return;
    }

    onNotice(UI_MESSAGES.notificationRetried);
    await loadNotifications(notificationFilters, { notify: true });
  };

  const applyNotificationFilters = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await loadNotifications(notificationFilters, { notify: true });
  };

  const resetNotificationFilters = async (): Promise<void> => {
    const next = { status: "", channel: "", deliveryStatus: "" };
    setNotificationFilters(next);
    await loadNotifications(next, { notify: true });
  };

  const selectedAttendance = attendanceRecords.find((item) => item.id === selectedAttendanceId) || null;
  const showAttendance = focusSection === "attendance";
  const showTimetable = focusSection === "timetable";
  const showNotifications = focusSection === "notifications";
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
      {showAttendance ? (
      <WorkflowGuide
        title={tr("Absences")}
        steps={attendanceSteps}
        activeStepId={attendanceWorkflowStep}
        onStepChange={setAttendanceWorkflowStep}
      >
      <section data-step-id="absences" className="panel editor-panel workflow-section module-modern">
        <h2>{tr("Absences")}</h2>
        <p className="section-lead">{tr("Saisissez un pointage individuel clair, lisible et rapidement exploitable.")}</p>
        {renderLoadWarning("attendance", "Journal des absences indisponible")}
        <ResponsiveForm className="form-grid module-form" formTitle={tr("Enregistrer une absence")} onSubmit={(event) => void submitAttendance(event)}>
          <label>
            {tr("Eleve")}<select value={attendanceForm.studentId} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, studentId: event.target.value }))} required>
              <option value="">{tr("Choisir...")}</option>
              {students.map((item) => (
                <option key={item.id} value={item.id}>{item.matricule} - {item.firstName} {item.lastName}</option>
              ))}
            </select>
          </label>
          <label>
            {tr("Classe")}<select value={attendanceForm.classId} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, classId: event.target.value }))} required>
              <option value="">{tr("Choisir...")}</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.code} - {item.label}</option>
              ))}
            </select>
          </label>
          <label>
            {tr("Date")}<input type="date" value={attendanceForm.attendanceDate} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, attendanceDate: event.target.value }))} required />
          </label>
          <label>
            {tr("Statut")}<select value={attendanceForm.status} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="PRESENT">{labelFromMap(attendanceStatusLabels, "PRESENT")}</option>
              <option value="ABSENT">{labelFromMap(attendanceStatusLabels, "ABSENT")}</option>
              <option value="LATE">{labelFromMap(attendanceStatusLabels, "LATE")}</option>
              <option value="EXCUSED">{labelFromMap(attendanceStatusLabels, "EXCUSED")}</option>
            </select>
          </label>
          <label>
            {tr("Motif")}<input value={attendanceForm.reason} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, reason: event.target.value }))} />
          </label>
          <button type="submit">{tr("Enregistrer")}</button>
        </ResponsiveForm>
      </section>

      <section data-step-id="bulk" className="panel editor-panel workflow-section module-modern">
        <h2>{tr("Absences - saisie de masse")}</h2>
        <p className="section-lead">{tr("Traitez une classe complete sans perdre la lisibilite du journal des absences.")}</p>
        <ResponsiveForm className="form-grid module-form" formTitle={tr("Absences - saisie de masse")} onSubmit={(event) => void submitBulkAttendance(event)}>
          <div className="split-grid">
            <label>{tr("Classe")}<select value={bulkAttendanceForm.classId} onChange={(event) => setBulkAttendanceForm((prev) => ({ ...prev, classId: event.target.value }))} required><option value="">{tr("Choisir...")}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.label}</option>)}</select></label>
            <label>{tr("Date")}<input type="date" value={bulkAttendanceForm.attendanceDate} onChange={(event) => setBulkAttendanceForm((prev) => ({ ...prev, attendanceDate: event.target.value }))} required /></label>
            <label>{tr("Statut")}<select value={bulkAttendanceForm.defaultStatus} onChange={(event) => setBulkAttendanceForm((prev) => ({ ...prev, defaultStatus: event.target.value }))}><option value="PRESENT">{labelFromMap(attendanceStatusLabels, "PRESENT")}</option><option value="ABSENT">{labelFromMap(attendanceStatusLabels, "ABSENT")}</option><option value="LATE">{labelFromMap(attendanceStatusLabels, "LATE")}</option><option value="EXCUSED">{labelFromMap(attendanceStatusLabels, "EXCUSED")}</option></select></label>
            <label>{tr("Motif global")}<input value={bulkAttendanceForm.reason} onChange={(event) => setBulkAttendanceForm((prev) => ({ ...prev, reason: event.target.value }))} /></label>
          </div>
          <label>
            {tr("Eleves concernes")}<select
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
          <p className="subtle hint">{tr("Ctrl/Cmd + clic pour multi-selection.")}</p>
          <button type="submit">{tr("Enregistrer en masse")}</button>
        </ResponsiveForm>
      </section>
      <section data-step-id="journal" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <h2>{tr("Journal des absences")}</h2>
          <span className="subtle">{tr("Filtre rapide, puis actions sur chaque ligne.")}</span>
        </div>
        {renderLoadWarning("attendance", "Journal des absences indisponible")}
        <form className="filter-grid module-filter" onSubmit={(event) => void applyAttendanceFilters(event)}>
          <label>{tr("Classe")}<select value={attendanceFilters.classId} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, classId: event.target.value }))}><option value="">{tr("Toutes")}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
          <label>{tr("Eleve")}<select value={attendanceFilters.studentId} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, studentId: event.target.value }))}><option value="">{tr("Tous")}</option>{students.map((item) => <option key={item.id} value={item.id}>{item.matricule}</option>)}</select></label>
          <label>{tr("Statut")}<select value={attendanceFilters.status} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="">{tr("Tous")}</option><option value="PRESENT">{labelFromMap(attendanceStatusLabels, "PRESENT")}</option><option value="ABSENT">{labelFromMap(attendanceStatusLabels, "ABSENT")}</option><option value="LATE">{labelFromMap(attendanceStatusLabels, "LATE")}</option><option value="EXCUSED">{labelFromMap(attendanceStatusLabels, "EXCUSED")}</option></select></label>
          <label>{tr("Du")}<input type="date" value={attendanceFilters.fromDate} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, fromDate: event.target.value }))} /></label>
          <label>{tr("Au")}<input type="date" value={attendanceFilters.toDate} onChange={(event) => setAttendanceFilters((prev) => ({ ...prev, toDate: event.target.value }))} /></label>
          <div className="actions"><button type="submit">{tr("Filtrer")}</button><button type="button" className="button-ghost" onClick={() => void resetAttendanceFilters()}>{tr("Reinitialiser")}</button></div>
        </form>
        <div className="table-wrap">
          <table data-responsive-table="true">
            <thead>
              <tr><th>{tr("Date")}</th><th>{tr("Eleve")}</th><th>{tr("Classe")}</th><th>{tr("Statut")}</th><th>{tr("Justif.")}</th><th>{tr("Validation")}</th><th>{tr("Pieces")}</th><th>{tr("Motif")}</th><th>{tr("Action")}</th></tr>
            </thead>
            <tbody>
              {attendanceRecords.length === 0 ? (
                <tr><td colSpan={9} className="empty-row">{tr("Aucune ligne.")}</td></tr>
              ) : (
                attendanceRecords.map((item) => (
                  <tr key={item.id}>
                    <td data-label={tr("Date")}>{item.attendanceDate}</td>
                    <td data-label={tr("Eleve")}>{item.studentName || "-"}</td>
                    <td data-label={tr("Classe")}>{item.classLabel || "-"}</td>
                    <td data-label={tr("Statut")}>{labelFromMap(attendanceStatusLabels, item.status)}</td>
                    <td data-label={tr("Justif.")}>{labelFromMap(validationStatusLabels, item.justificationStatus)}</td>
                    <td data-label={tr("Validation")}>
                      {item.validatedAt
                        ? `${new Date(item.validatedAt).toLocaleString(locale)}${item.validationComment ? ` | ${item.validationComment}` : ""}`
                        : item.validationComment || "-"}
                    </td>
                    <td data-label={tr("Pieces")}>{item.attachments?.length ?? 0}</td>
                    <td data-label={tr("Motif")}>{item.reason || "-"}</td>
                    <td data-label={tr("Action")}>
                      {renderActionMenu(`attendance-${item.id}`, `Actions absence ${item.studentName || item.id}`, [
                        { label: "Supprimer", danger: true, onSelect: () => void deleteAttendance(item.id) }
                      ])}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section data-step-id="validation" className="panel editor-panel workflow-section module-modern">
        <h2>{tr("Justificatifs & validation")}</h2>
        <p className="section-lead">{tr("Centralisez validation et pieces justificatives sans ouvrir plusieurs ecrans.")}</p>
        {renderLoadWarning("attachments", "Justificatifs indisponibles")}
        <h3>{tr("Validation")}</h3>
        <ResponsiveForm className="form-grid module-form" formTitle={tr("Enregistrer validation")} onSubmit={(event) => void submitAttendanceValidation(event)}>
          <div className="split-grid">
            <label>
              {tr("Pointage cible")}<select value={selectedAttendanceId} onChange={(event) => setSelectedAttendanceId(event.target.value)}>
                <option value="">{tr("Choisir...")}</option>
                {attendanceRecords.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.attendanceDate} - {item.studentName || item.studentId} ({item.status})
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("Statut justification")}<select
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
              {tr("Commentaire validation")}<input
                value={validationForm.comment}
                onChange={(event) =>
                  setValidationForm((prev) => ({ ...prev, comment: event.target.value }))
                }
                disabled={!selectedAttendanceId}
              />
            </label>
          </div>
          <div className="actions">
            <button type="submit" disabled={!selectedAttendanceId}>{tr("Enregistrer validation")}</button>
          </div>
        </ResponsiveForm>

        <h3>{tr("Ajout de justificatif")}</h3>
        <ResponsiveForm className="form-grid module-form" formTitle={tr("Ajout de justificatif")} onSubmit={(event) => void submitAttendanceAttachment(event)}>
          <label>
            {tr("Fichier justificatif")}<input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
              disabled={!selectedAttendanceId}
              required
            />
          </label>
          <div className="actions">
            <button type="submit" disabled={!selectedAttendanceId}>{tr("Ajouter justificatif")}</button>
          </div>
        </ResponsiveForm>

        <h3>{tr("Liste des justificatifs")}</h3>
        <div className="table-wrap">
          <table data-responsive-table="true">
            <thead>
              <tr><th>{tr("Fichier")}</th><th>{tr("MIME")}</th><th>{tr("Ajoute le")}</th><th>{tr("Action")}</th></tr>
            </thead>
            <tbody>
              {!selectedAttendanceId ? (
                <tr><td colSpan={4} className="empty-row">{tr("Selectionner une absence.")}</td></tr>
              ) : attendanceAttachments.length === 0 ? (
                <tr><td colSpan={4} className="empty-row">{tr("Aucun justificatif.")}</td></tr>
              ) : (
                attendanceAttachments.map((item) => (
                  <tr key={item.id}>
                    <td data-label={tr("Fichier")}><button type="button" className="button-link" onClick={() => void downloadAttachment(item)}>{item.fileName}</button></td>
                    <td data-label={tr("MIME")}>{item.mimeType || "-"}</td>
                    <td data-label={tr("Ajoute le")}>{new Date(item.createdAt).toLocaleString(locale)}</td>
                    <td data-label={tr("Action")}>
                      {renderActionMenu(`attachment-${item.id}`, `Actions justificatif ${item.fileName}`, [
                        { label: "Supprimer", danger: true, onSelect: () => void removeAttendanceAttachment(item.id) }
                      ])}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selectedAttendance ? (
          <p className="subtle">{tr("Selection active: ")}{selectedAttendance.studentName || selectedAttendance.studentId} - {selectedAttendance.attendanceDate}</p>
        ) : null}
      </section>
      </WorkflowGuide>
      ) : null}

      {showTimetable ? (
      <WorkflowGuide
        title={tr("Emploi du temps")}
        steps={timetableSteps}
        activeStepId={timetableWorkflowStep}
        onStepChange={setTimetableWorkflowStep}
      >
      <section data-step-id="timetable" className="panel editor-panel workflow-section module-modern">
        <h2>{tr("Emploi du temps")}</h2>
        <p className="section-lead">{tr("Composez des creneaux lisibles puis controlez la semaine complete en un seul coup d'oeil.")}</p>
        {renderLoadWarning("timetable", "References emploi du temps indisponibles")}
        <ResponsiveForm className="form-grid module-form" formTitle={tr("Ajouter un créneau")} onSubmit={(event) => void submitTimetableSlot(event)}>
          <label>{tr("Classe")}<select value={timetableForm.classId} onChange={(event) => setTimetableForm((prev) => ({ ...prev, classId: event.target.value }))} required>{classes.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.label}</option>)}</select></label>
          <label>{tr("Matiere")}<select value={timetableForm.subjectId} onChange={(event) => setTimetableForm((prev) => ({ ...prev, subjectId: event.target.value }))} required>{subjects.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.label}</option>)}</select></label>
          <label>{tr("Jour")}<select value={timetableForm.dayOfWeek} onChange={(event) => setTimetableForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}>{[1,2,3,4,5,6,7].map((day) => <option key={day} value={String(day)}>{dayLabels.get(day)}</option>)}</select></label>
          <label>{tr("Debut")}<input type="time" value={timetableForm.startTime} onChange={(event) => setTimetableForm((prev) => ({ ...prev, startTime: event.target.value }))} required /></label>
          <label>{tr("Fin")}<input type="time" value={timetableForm.endTime} onChange={(event) => setTimetableForm((prev) => ({ ...prev, endTime: event.target.value }))} required /></label>
          <label>{tr("Salle")}<select value={timetableForm.roomId} onChange={(event) => setTimetableForm((prev) => ({ ...prev, roomId: event.target.value }))}><option value="">{tr("Non definie")}</option>{activeRooms.map((room) => <option key={room.id} value={room.id}>{room.code} - {room.name}</option>)}</select></label>
          <label>{tr("Enseignant")}<select value={timetableForm.teacherAssignmentId} onChange={(event) => setTimetableForm((prev) => ({ ...prev, teacherAssignmentId: event.target.value }))}><option value="">{tr("Non defini")}</option>{compatibleTeacherAssignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.teacherName || tr("Enseignant")} - {assignment.subjectLabel || tr("Matiere")} - {assignment.classLabel || tr("Classe")}</option>)}</select></label>
          <button type="submit">{tr("Ajouter")}</button>
        </ResponsiveForm>
      </section>

      <section data-step-id="grid" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <h2>{tr("Grille d'emploi du temps")}</h2>
          <span className="subtle">{tr("Recherche par classe et par jour.")}</span>
        </div>
        {renderLoadWarning("timetable", "Grille emploi du temps indisponible")}
        <form className="filter-grid module-filter" onSubmit={(event) => void applyTimetableFilters(event)}>
          <label>{tr("Classe")}<select value={timetableFilters.classId} onChange={(event) => setTimetableFilters((prev) => ({ ...prev, classId: event.target.value }))}><option value="">{tr("Toutes")}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
          <label>{tr("Jour")}<select value={timetableFilters.dayOfWeek} onChange={(event) => setTimetableFilters((prev) => ({ ...prev, dayOfWeek: event.target.value }))}><option value="">{tr("Tous")}</option>{[1,2,3,4,5,6,7].map((day) => <option key={day} value={String(day)}>{dayLabels.get(day)}</option>)}</select></label>
          <div className="actions"><button type="submit">{tr("Filtrer")}</button><button type="button" className="button-ghost" onClick={() => void resetTimetableFilters()}>{tr("Reinitialiser")}</button></div>
        </form>
        <div className="table-wrap">
          <table data-responsive-table="true">
            <thead>
              <tr><th>{tr("Jour")}</th><th>{tr("Heure")}</th><th>{tr("Classe")}</th><th>{tr("Matiere")}</th><th>{tr("Salle")}</th><th>{tr("Enseignant")}</th><th>{tr("Action")}</th></tr>
            </thead>
            <tbody>
              {timetableSlots.length === 0 ? (
                <tr><td colSpan={7} className="empty-row">{tr("Aucun cours.")}</td></tr>
              ) : (
                timetableSlots.map((item) => (
                  <tr key={item.id}>
                    <td data-label={tr("Jour")}>{dayLabels.get(item.dayOfWeek) || item.dayOfWeek}</td>
                    <td data-label={tr("Heure")}>{item.startTime} - {item.endTime}</td>
                    <td data-label={tr("Classe")}>{item.classLabel || "-"}</td>
                    <td data-label={tr("Matiere")}>{item.subjectLabel || "-"}</td>
                    <td data-label={tr("Salle")}>{item.room || "-"}</td>
                    <td data-label={tr("Enseignant")}>{item.teacherName || "-"}</td>
                    <td data-label={tr("Action")}>
                      {renderActionMenu(`timetable-${item.id}`, `Actions cours ${item.subjectLabel || item.id}`, [
                        { label: "Supprimer", danger: true, onSelect: () => void deleteTimetableSlot(item.id) }
                      ])}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <h3>{tr("Vue hebdo")}</h3>
        <div className="day-grid">
          {(timetableGrid?.days || []).map((day) => (
            <article key={day.dayOfWeek} className="day-card">
              <h4>{day.dayLabel}</h4>
              {day.slots.length === 0 ? (
                <p className="subtle">{tr("Aucun cours")}</p>
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
        title={tr("Notifications")}
        steps={notificationSteps}
        activeStepId={notificationWorkflowStep}
        onStepChange={setNotificationWorkflowStep}
      >
      <section data-step-id="notifications" className="panel editor-panel workflow-section module-modern">
        <div className="headline-row">
          <h2>{tr("Notifications")}</h2>
          <div className="inline-actions">
            <button type="button" className="button-ghost" onClick={() => void dispatchPendingNotifications()}>
              {tr("Envoyer les notifications en attente")}</button>
          </div>
        </div>
        <p className="section-lead">{tr("Programmez les messages importants avec un flux plus propre pour les equipes.")}</p>
        {renderLoadWarning("notifications", "Notifications indisponibles")}
        <ResponsiveForm className="form-grid module-form" formTitle={tr("Programmer une notification")} onSubmit={(event) => void submitNotification(event)}>
          <label>{tr("Titre")}<input value={notificationForm.title} onChange={(event) => setNotificationForm((prev) => ({ ...prev, title: event.target.value }))} required /></label>
          <label>{tr("Message")}<input value={notificationForm.message} onChange={(event) => setNotificationForm((prev) => ({ ...prev, message: event.target.value }))} required /></label>
          <label>{tr("Audience")}<select value={notificationForm.audienceRole} onChange={(event) => setNotificationForm((prev) => ({ ...prev, audienceRole: event.target.value }))}><option value="">{tr("Aucun")}</option><option value="PARENT">{labelFromMap(notificationAudienceLabels, "PARENT")}</option><option value="ENSEIGNANT">{labelFromMap(notificationAudienceLabels, "ENSEIGNANT")}</option><option value="SCOLARITE">{labelFromMap(notificationAudienceLabels, "SCOLARITE")}</option><option value="COMPTABLE">{labelFromMap(notificationAudienceLabels, "COMPTABLE")}</option></select></label>
          <label>{tr("Eleve")}<select value={notificationForm.studentId} onChange={(event) => setNotificationForm((prev) => ({ ...prev, studentId: event.target.value }))}><option value="">{tr("Aucun")}</option>{students.map((item) => <option key={item.id} value={item.id}>{item.matricule} - {item.firstName} {item.lastName}</option>)}</select></label>
          <label>{tr("Canal")}<select value={notificationForm.channel} onChange={(event) => setNotificationForm((prev) => ({ ...prev, channel: event.target.value }))}><option value="IN_APP">{labelFromMap(notificationChannelLabels, "IN_APP")}</option><option value="EMAIL">{labelFromMap(notificationChannelLabels, "EMAIL")}</option><option value="SMS">{labelFromMap(notificationChannelLabels, "SMS")}</option></select></label>
          <label>{tr("Cible explicite")}<input value={notificationForm.targetAddress} onChange={(event) => setNotificationForm((prev) => ({ ...prev, targetAddress: event.target.value }))} placeholder={tr("Email ou telephone")} /></label>
          <label>{tr("Planifiee")}<input type="datetime-local" value={notificationForm.scheduledAt} onChange={(event) => setNotificationForm((prev) => ({ ...prev, scheduledAt: event.target.value }))} /></label>
          <button type="submit">{tr("Programmer l'envoi")}</button>
        </ResponsiveForm>
      </section>

      <section data-step-id="history" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <h2>{tr("Historique notifications")}</h2>
          <span className="subtle">{tr("Suivi des envois, statuts et relances.")}</span>
        </div>
        {renderLoadWarning("notifications", "Historique notifications indisponible")}
        <form className="filter-grid module-filter" onSubmit={(event) => void applyNotificationFilters(event)}>
          <label>{tr("Statut")}<select value={notificationFilters.status} onChange={(event) => setNotificationFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="">{tr("Tous")}</option>{Object.entries(notificationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>{tr("Canal")}<select value={notificationFilters.channel} onChange={(event) => setNotificationFilters((prev) => ({ ...prev, channel: event.target.value }))}><option value="">{tr("Tous")}</option><option value="IN_APP">{labelFromMap(notificationChannelLabels, "IN_APP")}</option><option value="EMAIL">{labelFromMap(notificationChannelLabels, "EMAIL")}</option><option value="SMS">{labelFromMap(notificationChannelLabels, "SMS")}</option></select></label>
          <label>{tr("Distribution")}<select value={notificationFilters.deliveryStatus} onChange={(event) => setNotificationFilters((prev) => ({ ...prev, deliveryStatus: event.target.value }))}><option value="">{tr("Toutes")}</option>{Object.entries(notificationDeliveryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="actions"><button type="submit">{tr("Filtrer")}</button><button type="button" className="button-ghost" onClick={() => void resetNotificationFilters()}>{tr("Reinitialiser")}</button></div>
        </form>
        <div className="table-wrap">
          <table data-responsive-table="true">
            <thead>
              <tr><th>{tr("Titre")}</th><th>{tr("Canal")}</th><th>{tr("Statut")}</th><th>{tr("Distribution")}</th><th>{tr("Cible")}</th><th>{tr("Fournisseur")}</th><th>{tr("Tentatives")}</th><th>{tr("Planifiee")}</th><th>{tr("Envoyee")}</th><th>{tr("Action")}</th></tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr><td colSpan={10} className="empty-row">{tr("Aucune notification.")}</td></tr>
              ) : (
                notifications.map((item) => (
                  <tr key={item.id}>
                    <td data-label={tr("Titre")}>{item.title}</td>
                    <td data-label={tr("Canal")}>{labelFromMap(notificationChannelLabels, item.channel)}</td>
                    <td data-label={tr("Statut")}>{labelFromMap(notificationStatusLabels, item.status)}</td>
                    <td data-label={tr("Distribution")}>{labelFromMap(notificationDeliveryLabels, item.deliveryStatus)}</td>
                    <td data-label={tr("Cible")}>{item.targetAddress || item.studentName || labelFromMap(notificationAudienceLabels, item.audienceRole) || "-"}</td>
                    <td data-label={tr("Fournisseur")}>{item.provider || "-"}</td>
                    <td data-label={tr("Tentatives")}>{item.attempts}</td>
                    <td data-label={tr("Planifiee")}>{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString(locale) : "-"}</td>
                    <td data-label={tr("Envoyee")}>{item.sentAt ? new Date(item.sentAt).toLocaleString(locale) : item.nextAttemptAt ? tr(`Nouvelle tentative ${new Date(item.nextAttemptAt).toLocaleString(locale)}`) : "-"}</td>
                    <td data-label={tr("Action")}>
                      {["PENDING", "FAILED_RETRYABLE"].includes(item.status)
                        ? renderActionMenu(`notification-${item.id}`, `Actions notification ${item.title}`, [
                            { danger: true, label: "Annuler", onSelect: () => void cancelPendingNotification(item.id) }
                          ])
                        : ["FAILED_PERMANENT", "DEAD_LETTER"].includes(item.status)
                          ? renderActionMenu(`notification-${item.id}`, `Actions notification ${item.title}`, [
                              { label: "Relancer", onSelect: () => void replayFailedNotification(item.id) }
                            ])
                          : <span className="subtle">{labelFromMap(notificationStatusLabels, item.status)}</span>}
                    </td>
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
