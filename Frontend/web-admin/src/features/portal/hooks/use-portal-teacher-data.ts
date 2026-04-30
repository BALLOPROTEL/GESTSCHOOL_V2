import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import type { FieldErrors, Period, Subject } from "../../../shared/types/app";
import {
  createTeacherAttendanceBulk,
  createTeacherNotification,
  createTeacherPortalGrade,
  fetchTeacherPortalData
} from "../services/portal-teacher-service";
import type {
  PortalApiClient,
  TeacherAttendanceForm,
  TeacherGradeForm,
  TeacherNotificationForm,
  TeacherPortalData,
  TeacherPortalFilters
} from "../types/portal-teacher";

type UsePortalTeacherDataOptions = {
  api: PortalApiClient;
  initialData: TeacherPortalData;
  subjects: Subject[];
  periods: Period[];
  remoteEnabled?: boolean;
  onDataChange?: (data: TeacherPortalData) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

const today = (): string => new Date().toISOString().slice(0, 10);
const hasFieldErrors = (errors: FieldErrors): boolean => Object.keys(errors).length > 0;

const focusFirstInlineErrorField = (stepId?: string): void => {
  window.setTimeout(() => {
    const scope = stepId
      ? document.querySelector(`[data-step-id="${stepId}"][data-active-step="true"], [data-step-id="${stepId}"]`)
      : document;
    const errorNode = scope?.querySelector(".field-error");
    const input = errorNode?.closest("label")?.querySelector<HTMLElement>("input, select, textarea");
    input?.focus();
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 0);
};

const buildFilters = (): TeacherPortalFilters => ({
  classId: "",
  subjectId: "",
  academicPeriodId: "",
  studentId: ""
});

const buildGradeForm = (): TeacherGradeForm => ({
  studentId: "",
  classId: "",
  subjectId: "",
  academicPeriodId: "",
  assessmentLabel: "Devoir 1",
  assessmentType: "DEVOIR",
  score: "",
  scoreMax: "20",
  comment: ""
});

const buildAttendanceForm = (): TeacherAttendanceForm => ({
  classId: "",
  attendanceDate: today(),
  defaultStatus: "PRESENT",
  reason: ""
});

const buildNotificationForm = (): TeacherNotificationForm => ({
  classId: "",
  studentId: "",
  title: "",
  message: "",
  channel: "IN_APP"
});

export const usePortalTeacherData = ({
  api,
  initialData,
  subjects,
  periods,
  remoteEnabled = true,
  onDataChange,
  onError,
  onNotice
}: UsePortalTeacherDataOptions) => {
  const [data, setData] = useState<TeacherPortalData>(initialData);
  const [filters, setFilters] = useState<TeacherPortalFilters>(() => buildFilters());
  const [gradeForm, setGradeForm] = useState<TeacherGradeForm>(() => buildGradeForm());
  const [attendanceForm, setAttendanceForm] = useState<TeacherAttendanceForm>(() => buildAttendanceForm());
  const [attendanceStudents, setAttendanceStudents] = useState<string[]>([]);
  const [notificationForm, setNotificationForm] = useState<TeacherNotificationForm>(() => buildNotificationForm());
  const [errors, setErrors] = useState<FieldErrors>({});
  const onDataChangeRef = useRef(onDataChange);

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  const setDataAndNotify = useCallback(
    (nextData: TeacherPortalData) => {
      setData(nextData);
      onDataChangeRef.current?.(nextData);
    },
    []
  );

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const loadData = useCallback(
    async (nextFilters: TeacherPortalFilters = filters): Promise<void> => {
      if (!remoteEnabled) {
        setData(initialData);
        return;
      }
      try {
        setDataAndNotify(await fetchTeacherPortalData(api, nextFilters));
      } catch (error) {
        onError(error instanceof Error ? error.message : "Erreur de chargement du portail enseignant.");
      }
    },
    [api, filters, initialData, onError, remoteEnabled, setDataAndNotify]
  );

  useEffect(() => {
    if (!remoteEnabled) return;
    let isMounted = true;

    fetchTeacherPortalData(api, buildFilters())
      .then((nextData) => {
        if (isMounted) setDataAndNotify(nextData);
      })
      .catch((error) => {
        if (isMounted) {
          onError(error instanceof Error ? error.message : "Erreur de chargement du portail enseignant.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [api, onError, remoteEnabled, setDataAndNotify]);

  useEffect(() => {
    if (!filters.classId && data.classes[0]) {
      setFilters((previous) => ({ ...previous, classId: data.classes[0].classId }));
    }
    if (!gradeForm.classId && data.classes[0]) {
      setGradeForm((previous) => ({ ...previous, classId: data.classes[0].classId }));
    }
    if (!attendanceForm.classId && data.classes[0]) {
      setAttendanceForm((previous) => ({ ...previous, classId: data.classes[0].classId }));
    }
    if (!notificationForm.classId && data.classes[0]) {
      setNotificationForm((previous) => ({ ...previous, classId: data.classes[0].classId }));
    }
    if (!gradeForm.studentId && data.students[0]) {
      setGradeForm((previous) => ({ ...previous, studentId: data.students[0].studentId }));
    }
    if (!gradeForm.subjectId && subjects[0]) {
      setGradeForm((previous) => ({ ...previous, subjectId: subjects[0].id }));
    }

    const teacherFormSchoolYearId = data.classes.find((item) => item.classId === gradeForm.classId)?.schoolYearId;
    const compatiblePeriods = teacherFormSchoolYearId
      ? periods.filter((item) => item.schoolYearId === teacherFormSchoolYearId)
      : periods;
    if (!gradeForm.academicPeriodId && compatiblePeriods[0]) {
      setGradeForm((previous) => ({ ...previous, academicPeriodId: compatiblePeriods[0].id }));
    }
  }, [
    attendanceForm.classId,
    data.classes,
    data.students,
    filters.classId,
    gradeForm.academicPeriodId,
    gradeForm.classId,
    gradeForm.studentId,
    gradeForm.subjectId,
    notificationForm.classId,
    periods,
    subjects
  ]);

  useEffect(() => {
    const ensureCompatiblePeriod = (
      classId: string,
      periodId: string,
      onMismatch: (periodId: string) => void
    ): void => {
      if (!classId) return;
      const classroom = data.classes.find((item) => item.classId === classId);
      if (!classroom) return;
      const compatiblePeriods = periods.filter((item) => item.schoolYearId === classroom.schoolYearId);
      if (compatiblePeriods.length === 0) return;
      const current = periods.find((item) => item.id === periodId);
      if (!current || current.schoolYearId !== classroom.schoolYearId) {
        onMismatch(compatiblePeriods[0].id);
      }
    };

    ensureCompatiblePeriod(gradeForm.classId, gradeForm.academicPeriodId, (periodId) => {
      if (periodId !== gradeForm.academicPeriodId) {
        setGradeForm((previous) => ({ ...previous, academicPeriodId: periodId }));
      }
    });

    ensureCompatiblePeriod(filters.classId, filters.academicPeriodId, (periodId) => {
      if (periodId !== filters.academicPeriodId) {
        setFilters((previous) => ({ ...previous, academicPeriodId: periodId }));
      }
    });
  }, [
    data.classes,
    filters.academicPeriodId,
    filters.classId,
    gradeForm.academicPeriodId,
    gradeForm.classId,
    periods
  ]);

  const submitGrade = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    const nextErrors: FieldErrors = {};
    if (!gradeForm.studentId) nextErrors.studentId = "Eleve requis.";
    if (!gradeForm.classId) nextErrors.classId = "Classe requise.";
    if (!gradeForm.subjectId) nextErrors.subjectId = "Matiere requise.";
    if (!gradeForm.academicPeriodId) nextErrors.academicPeriodId = "Periode requise.";
    if (!gradeForm.assessmentLabel.trim()) nextErrors.assessmentLabel = "Libelle requis.";

    const score = Number(gradeForm.score);
    const scoreMax = Number(gradeForm.scoreMax || 20);
    if (!Number.isFinite(score) || score < 0) nextErrors.score = "Note invalide.";
    if (!Number.isFinite(scoreMax) || scoreMax <= 0) nextErrors.scoreMax = "Bareme invalide.";
    if (!hasFieldErrors(nextErrors) && score > scoreMax) nextErrors.score = "La note depasse le bareme.";

    setErrors(nextErrors);
    if (hasFieldErrors(nextErrors)) {
      focusFirstInlineErrorField("teacher-grade");
      return;
    }
    if (!remoteEnabled) {
      onNotice("Mode apercu local : note non persistee.");
      return;
    }

    try {
      await createTeacherPortalGrade(api, {
        studentId: gradeForm.studentId,
        classId: gradeForm.classId,
        subjectId: gradeForm.subjectId,
        academicPeriodId: gradeForm.academicPeriodId,
        assessmentLabel: gradeForm.assessmentLabel.trim(),
        assessmentType: gradeForm.assessmentType,
        score,
        scoreMax,
        comment: gradeForm.comment.trim() || undefined
      });
      setErrors({});
      onNotice("Note enseignant enregistree.");
      setGradeForm((previous) => ({ ...previous, score: "", comment: "" }));
      await loadData(filters);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur d'enregistrement de la note.");
    }
  };

  const submitAttendanceBulk = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    const nextErrors: FieldErrors = {};
    if (!attendanceForm.classId) nextErrors.classId = "Classe requise.";
    if (!attendanceForm.attendanceDate) nextErrors.attendanceDate = "Date requise.";
    if (attendanceStudents.length === 0) nextErrors.students = "Selectionner au moins un eleve.";

    setErrors(nextErrors);
    if (hasFieldErrors(nextErrors)) {
      focusFirstInlineErrorField("teacher-attendance");
      return;
    }
    if (!remoteEnabled) {
      onNotice("Mode apercu local : pointage non persiste.");
      return;
    }

    try {
      await createTeacherAttendanceBulk(api, {
        classId: attendanceForm.classId,
        attendanceDate: attendanceForm.attendanceDate,
        defaultStatus: attendanceForm.defaultStatus,
        entries: attendanceStudents.map((studentId) => ({
          studentId,
          reason: attendanceForm.reason.trim() || undefined
        }))
      });
      setErrors({});
      setAttendanceStudents([]);
      onNotice("Pointage enseignant enregistre.");
      await loadData(filters);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur d'enregistrement du pointage.");
    }
  };

  const submitNotification = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    const nextErrors: FieldErrors = {};
    if (!notificationForm.classId) nextErrors.classId = "Classe requise.";
    if (!notificationForm.title.trim()) nextErrors.title = "Titre requis.";
    if (!notificationForm.message.trim()) nextErrors.message = "Message requis.";

    setErrors(nextErrors);
    if (hasFieldErrors(nextErrors)) {
      focusFirstInlineErrorField("teacher-notifications");
      return;
    }
    if (!remoteEnabled) {
      onNotice("Mode apercu local : notification non persistee.");
      return;
    }

    try {
      await createTeacherNotification(api, {
        classId: notificationForm.classId,
        studentId: notificationForm.studentId || undefined,
        title: notificationForm.title.trim(),
        message: notificationForm.message.trim(),
        channel: notificationForm.channel
      });
      setErrors({});
      setNotificationForm((previous) => ({ ...previous, title: "", message: "" }));
      onNotice("Notification parent envoyee.");
      await loadData(filters);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur d'envoi de notification.");
    }
  };

  const resetFilters = async (): Promise<void> => {
    const nextFilters = buildFilters();
    setFilters(nextFilters);
    await loadData(nextFilters);
  };

  return {
    attendanceForm,
    attendanceStudents,
    data,
    errors,
    filters,
    gradeForm,
    loadData,
    notificationForm,
    resetFilters,
    setAttendanceForm,
    setAttendanceStudents,
    setFilters,
    setGradeForm,
    setNotificationForm,
    submitAttendanceBulk,
    submitGrade,
    submitNotification
  };
};
