import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import type {
  ClassItem,
  Enrollment,
  FieldErrors,
  SchoolYear,
  Student
} from "../../../shared/types/app";
import { translateUiString, UI_MESSAGES, type UiLanguage } from "../../../shared/i18n";
import { toUiErrorMessage } from "../../../shared/services/api-errors";
import { useConfirmDialog } from "../../../shared/components/confirm-dialog";
import {
  createEnrollment,
  fetchEnrollments,
  removeEnrollment,
  upsertEnrollmentPlacement
} from "../services/enrollments-service";
import type {
  EnrollmentFilters,
  EnrollmentForm,
  EnrollmentsApiClient
} from "../types/enrollments";

type UseEnrollmentsDataOptions = {
  api: EnrollmentsApiClient;
  initialEnrollments: Enrollment[];
  schoolYears: SchoolYear[];
  classes: ClassItem[];
  students: Student[];
  remoteEnabled?: boolean;
  language?: UiLanguage;
  onEnrollmentsChange?: (enrollments: Enrollment[]) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

const today = (): string => new Date().toISOString().slice(0, 10);
const hasFieldErrors = (errors: FieldErrors): boolean => Object.keys(errors).length > 0;

const focusFirstInlineErrorField = (stepId?: string): void => {
  window.setTimeout(() => {
    const scope = stepId
      ? document.querySelector(`[data-step-id="${stepId}"][data-active-step="true"]`)
      : document;

    if (!scope) return;
    const errorNode = scope.querySelector(".field-error");
    if (!errorNode) return;

    const label = errorNode.closest("label");
    const input = label?.querySelector<HTMLElement>("input, select, textarea");
    if (!input) return;

    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 0);
};

const buildInitialFilters = (): EnrollmentFilters => ({
  schoolYearId: "",
  classId: "",
  studentId: "",
  track: "",
  enrollmentStatus: ""
});

const buildInitialForm = (): EnrollmentForm => ({
  schoolYearId: "",
  classId: "",
  studentId: "",
  track: "FRANCOPHONE",
  enrollmentDate: today(),
  enrollmentStatus: "ENROLLED"
});

const normalizeEnrollmentStatus = (value: string): string =>
  value.trim().toUpperCase() || "ENROLLED";

const toPlacementStatus = (value: string): "ACTIVE" | "INACTIVE" | "COMPLETED" | "SUSPENDED" => {
  const normalized = normalizeEnrollmentStatus(value);
  if (normalized === "COMPLETED") return "COMPLETED";
  if (normalized === "SUSPENDED") return "SUSPENDED";
  if (normalized === "CANCELLED" || normalized === "INACTIVE") return "INACTIVE";
  return "ACTIVE";
};

export const useEnrollmentsData = ({
  api,
  initialEnrollments,
  schoolYears,
  classes,
  students,
  remoteEnabled = true,
  language = "fr",
  onEnrollmentsChange,
  onError,
  onNotice
}: UseEnrollmentsDataOptions) => {
  const confirmAction = useConfirmDialog();
  const initialEnrollmentsRef = useRef(initialEnrollments);
  const [enrollments, setEnrollments] = useState<Enrollment[]>(initialEnrollments);
  const [enrollmentFilters, setEnrollmentFilters] = useState<EnrollmentFilters>(() => buildInitialFilters());
  const [enrollmentForm, setEnrollmentForm] = useState<EnrollmentForm>(() => buildInitialForm());
  const [enrollmentErrors, setEnrollmentErrors] = useState<FieldErrors>({});
  const [enrollmentWorkflowStep, setEnrollmentWorkflowStep] = useState("list");
  const [editingEnrollmentId, setEditingEnrollmentId] = useState<string | null>(null);

  const setEnrollmentsAndNotify = useCallback(
    (nextEnrollments: Enrollment[]) => {
      setEnrollments(nextEnrollments);
      onEnrollmentsChange?.(nextEnrollments);
    },
    [onEnrollmentsChange]
  );

  useEffect(() => {
    initialEnrollmentsRef.current = initialEnrollments;
    setEnrollments(initialEnrollments);
  }, [initialEnrollments]);

  useEffect(() => {
    if (!enrollmentForm.schoolYearId && schoolYears[0]) {
      setEnrollmentForm((previous) => ({ ...previous, schoolYearId: schoolYears[0].id }));
    }
    if (!enrollmentForm.classId && classes[0]) {
      setEnrollmentForm((previous) => ({
        ...previous,
        classId: classes[0].id,
        track: classes[0].track
      }));
    }
    if (!enrollmentForm.studentId && students[0]) {
      setEnrollmentForm((previous) => ({ ...previous, studentId: students[0].id }));
    }
  }, [
    classes,
    enrollmentForm.classId,
    enrollmentForm.schoolYearId,
    enrollmentForm.studentId,
    schoolYears,
    students
  ]);

  useEffect(() => {
    const selectedClass = classes.find((item) => item.id === enrollmentForm.classId);
    if (selectedClass && enrollmentForm.track !== selectedClass.track) {
      setEnrollmentForm((previous) => ({ ...previous, track: selectedClass.track }));
    }
  }, [classes, enrollmentForm.classId, enrollmentForm.track]);

  const loadEnrollments = useCallback(
    async (filters: EnrollmentFilters = enrollmentFilters) => {
      if (!remoteEnabled) {
        setEnrollmentsAndNotify(initialEnrollmentsRef.current);
        return;
      }
      try {
        setEnrollmentsAndNotify(await fetchEnrollments(api, filters));
      } catch (error) {
        onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
      }
    },
    [api, enrollmentFilters, onError, remoteEnabled, setEnrollmentsAndNotify]
  );

  useEffect(() => {
    void loadEnrollments(buildInitialFilters());
  }, [loadEnrollments]);

  const resetEnrollmentForm = useCallback(() => {
    setEditingEnrollmentId(null);
    setEnrollmentErrors({});
    setEnrollmentForm((previous) => ({
      ...buildInitialForm(),
      schoolYearId: schoolYears[0]?.id || previous.schoolYearId,
      classId: classes[0]?.id || previous.classId,
      studentId: students[0]?.id || previous.studentId,
      track: classes[0]?.track || previous.track
    }));
  }, [classes, schoolYears, students]);

  const startEnrollmentEdit = useCallback((enrollment: Enrollment): void => {
    setEditingEnrollmentId(enrollment.id);
    setEnrollmentErrors({});
    setEnrollmentForm({
      schoolYearId: enrollment.schoolYearId,
      classId: enrollment.classId,
      studentId: enrollment.studentId,
      track: enrollment.track,
      enrollmentDate: enrollment.enrollmentDate || today(),
      enrollmentStatus: normalizeEnrollmentStatus(enrollment.enrollmentStatus)
    });
    setEnrollmentWorkflowStep("create");
  }, []);

  const submitEnrollment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);

    const editedEnrollment = editingEnrollmentId
      ? enrollments.find((item) => item.id === editingEnrollmentId) || null
      : null;
    const errors: FieldErrors = {};
    if (!enrollmentForm.schoolYearId) errors.schoolYearId = UI_MESSAGES.validationError;
    if (!enrollmentForm.classId) errors.classId = UI_MESSAGES.validationError;
    if (!enrollmentForm.studentId) errors.studentId = UI_MESSAGES.validationError;
    if (!enrollmentForm.track) errors.track = UI_MESSAGES.validationError;
    if (!enrollmentForm.enrollmentDate) errors.enrollmentDate = UI_MESSAGES.validationError;
    if (!enrollmentForm.enrollmentStatus.trim()) errors.enrollmentStatus = UI_MESSAGES.validationError;

    const selectedClass = classes.find((item) => item.id === enrollmentForm.classId);
    if (selectedClass && selectedClass.schoolYearId !== enrollmentForm.schoolYearId) {
      errors.classId = UI_MESSAGES.validationError;
    }
    if (selectedClass && selectedClass.track !== enrollmentForm.track) {
      errors.track = UI_MESSAGES.validationError;
    }
    if (editedEnrollment) {
      if (editedEnrollment.studentId !== enrollmentForm.studentId) {
        errors.studentId = UI_MESSAGES.validationError;
      }
      if (editedEnrollment.schoolYearId !== enrollmentForm.schoolYearId) {
        errors.schoolYearId = UI_MESSAGES.validationError;
      }
      if (editedEnrollment.track !== enrollmentForm.track) {
        errors.track = UI_MESSAGES.validationError;
      }
    }

    const duplicateEnrollment = enrollments.some((item) => {
      const status = item.enrollmentStatus.trim().toUpperCase();
      return (
        item.id !== editingEnrollmentId &&
        item.studentId === enrollmentForm.studentId &&
        item.schoolYearId === enrollmentForm.schoolYearId &&
        item.classId === enrollmentForm.classId &&
        item.track === enrollmentForm.track &&
        !["CANCELLED", "COMPLETED"].includes(status)
      );
    });
    if (duplicateEnrollment) {
      errors.studentId = UI_MESSAGES.conflict;
    }

    setEnrollmentErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("create");
      return;
    }
    if (!remoteEnabled) {
      if (editedEnrollment) {
        const selectedStudent = students.find((item) => item.id === enrollmentForm.studentId);
        const selectedYear = schoolYears.find((item) => item.id === enrollmentForm.schoolYearId);
        const nextEnrollments = enrollments.map((item) =>
          item.id === editedEnrollment.id
            ? {
                ...item,
                classId: enrollmentForm.classId,
                track: enrollmentForm.track,
                enrollmentDate: enrollmentForm.enrollmentDate || today(),
                enrollmentStatus: normalizeEnrollmentStatus(enrollmentForm.enrollmentStatus),
                studentName:
                  item.studentName ||
                  `${selectedStudent?.firstName || ""} ${selectedStudent?.lastName || ""}`.trim(),
                classLabel: selectedClass?.label || item.classLabel,
                schoolYearCode: selectedYear?.code || item.schoolYearCode
              }
            : item
        );
        setEnrollmentsAndNotify(nextEnrollments);
        setNoticeAndStep(UI_MESSAGES.previewNotPersisted, "list");
        setEditingEnrollmentId(null);
        return;
      }
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }

    try {
      if (editedEnrollment) {
        if (!selectedClass?.levelId) {
          onError(UI_MESSAGES.enrollmentClassWithoutLevel);
          return;
        }
        await upsertEnrollmentPlacement(api, {
          schoolYearId: enrollmentForm.schoolYearId,
          classId: enrollmentForm.classId,
          studentId: enrollmentForm.studentId,
          track: enrollmentForm.track,
          levelId: selectedClass.levelId,
          placementStatus: toPlacementStatus(enrollmentForm.enrollmentStatus),
          startDate: enrollmentForm.enrollmentDate || today(),
          isPrimary: Boolean(editedEnrollment.isPrimary)
        });
        setEditingEnrollmentId(null);
        setNoticeAndStep(UI_MESSAGES.updated, "list");
      } else {
        await createEnrollment(api, {
          schoolYearId: enrollmentForm.schoolYearId,
          classId: enrollmentForm.classId,
          studentId: enrollmentForm.studentId,
          track: enrollmentForm.track,
          enrollmentDate: enrollmentForm.enrollmentDate || today(),
          enrollmentStatus: normalizeEnrollmentStatus(enrollmentForm.enrollmentStatus)
        });
        setNoticeAndStep(UI_MESSAGES.created, "list");
      }
      setEnrollmentErrors({});
      await loadEnrollments(enrollmentFilters);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  const setNoticeAndStep = (message: string, step: string): void => {
    onNotice(message);
    setEnrollmentWorkflowStep(step);
  };

  const deleteEnrollment = async (id: string): Promise<void> => {
    if (!(await confirmAction({
      description: translateUiString(language, UI_MESSAGES.enrollmentDeleteConfirm),
      confirmLabel: translateUiString(language, "Supprimer"),
      tone: "danger"
    }))) return;
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }
    try {
      await removeEnrollment(api, id);
      onNotice(UI_MESSAGES.deleted);
      await loadEnrollments(enrollmentFilters);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.deleteError));
    }
  };

  const resetEnrollmentFilters = async (): Promise<void> => {
    const next = buildInitialFilters();
    setEnrollmentFilters(next);
    await loadEnrollments(next);
  };

  return {
    deleteEnrollment,
    editingEnrollmentId,
    enrollmentErrors,
    enrollmentFilters,
    enrollmentForm,
    enrollments,
    enrollmentWorkflowStep,
    loadEnrollments,
    resetEnrollmentFilters,
    resetEnrollmentForm,
    setEnrollmentFilters,
    setEnrollmentForm,
    setEnrollmentWorkflowStep,
    startEnrollmentEdit,
    submitEnrollment
  };
};
