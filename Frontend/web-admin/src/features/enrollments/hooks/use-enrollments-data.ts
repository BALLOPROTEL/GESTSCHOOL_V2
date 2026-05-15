import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type {
  ClassItem,
  Enrollment,
  FieldErrors,
  SchoolYear,
  Student
} from "../../../shared/types/app";
import { translateUiString, type UiLanguage } from "../../../shared/i18n";
import {
  createEnrollment,
  fetchEnrollments,
  removeEnrollment
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
  const [enrollments, setEnrollments] = useState<Enrollment[]>(initialEnrollments);
  const [enrollmentFilters, setEnrollmentFilters] = useState<EnrollmentFilters>(() => buildInitialFilters());
  const [enrollmentForm, setEnrollmentForm] = useState<EnrollmentForm>(() => buildInitialForm());
  const [enrollmentErrors, setEnrollmentErrors] = useState<FieldErrors>({});
  const [enrollmentWorkflowStep, setEnrollmentWorkflowStep] = useState("create");

  const setEnrollmentsAndNotify = useCallback(
    (nextEnrollments: Enrollment[]) => {
      setEnrollments(nextEnrollments);
      onEnrollmentsChange?.(nextEnrollments);
    },
    [onEnrollmentsChange]
  );

  useEffect(() => {
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
        setEnrollmentsAndNotify(initialEnrollments);
        return;
      }
      try {
        setEnrollmentsAndNotify(await fetchEnrollments(api, filters));
      } catch (error) {
        onError(error instanceof Error ? error.message : "Erreur de chargement des inscriptions.");
      }
    },
    [api, enrollmentFilters, initialEnrollments, onError, remoteEnabled, setEnrollmentsAndNotify]
  );

  useEffect(() => {
    void loadEnrollments(buildInitialFilters());
  }, [loadEnrollments]);

  const submitEnrollment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);

    const errors: FieldErrors = {};
    if (!enrollmentForm.schoolYearId) errors.schoolYearId = "Année scolaire requise.";
    if (!enrollmentForm.classId) errors.classId = "Classe requise.";
    if (!enrollmentForm.studentId) errors.studentId = "Élève requis.";
    if (!enrollmentForm.track) errors.track = "Cursus requis.";
    if (!enrollmentForm.enrollmentDate) errors.enrollmentDate = "Date d'inscription requise.";
    if (!enrollmentForm.enrollmentStatus.trim()) errors.enrollmentStatus = "Statut requis.";

    const selectedClass = classes.find((item) => item.id === enrollmentForm.classId);
    if (selectedClass && selectedClass.schoolYearId !== enrollmentForm.schoolYearId) {
      errors.classId = "La classe doit appartenir à l'année sélectionnée.";
    }
    if (selectedClass && selectedClass.track !== enrollmentForm.track) {
      errors.track = "Le cursus doit correspondre à la classe sélectionnée.";
    }

    const duplicateEnrollment = enrollments.some((item) => {
      const status = item.enrollmentStatus.trim().toUpperCase();
      return (
        item.studentId === enrollmentForm.studentId &&
        item.schoolYearId === enrollmentForm.schoolYearId &&
        item.classId === enrollmentForm.classId &&
        item.track === enrollmentForm.track &&
        !["CANCELLED", "COMPLETED"].includes(status)
      );
    });
    if (duplicateEnrollment) {
      errors.studentId = "Cet élève possède déjà un placement actif sur cette année, cette classe et ce cursus.";
    }

    setEnrollmentErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("create");
      return;
    }
    if (!remoteEnabled) {
      onNotice(translateUiString(language, "Mode aperçu local : inscription non persistée."));
      return;
    }

    try {
      await createEnrollment(api, {
        schoolYearId: enrollmentForm.schoolYearId,
        classId: enrollmentForm.classId,
        studentId: enrollmentForm.studentId,
        track: enrollmentForm.track,
        enrollmentDate: enrollmentForm.enrollmentDate || today(),
        enrollmentStatus: enrollmentForm.enrollmentStatus.trim().toUpperCase() || "ENROLLED"
      });
      setNoticeAndStep(translateUiString(language, "Inscription créée."), "list");
      setEnrollmentErrors({});
      await loadEnrollments(enrollmentFilters);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur de création d'inscription.");
    }
  };

  const setNoticeAndStep = (message: string, step: string): void => {
    onNotice(message);
    setEnrollmentWorkflowStep(step);
  };

  const deleteEnrollment = async (id: string): Promise<void> => {
    if (!window.confirm(translateUiString(language, "Supprimer cette inscription ?"))) return;
    if (!remoteEnabled) {
      onNotice(translateUiString(language, "Mode aperçu local : suppression non persistée."));
      return;
    }
    try {
      await removeEnrollment(api, id);
      onNotice(translateUiString(language, "Inscription supprimée."));
      await loadEnrollments(enrollmentFilters);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur de suppression d'inscription.");
    }
  };

  const resetEnrollmentFilters = async (): Promise<void> => {
    const next = buildInitialFilters();
    setEnrollmentFilters(next);
    await loadEnrollments(next);
  };

  const enrollmentSteps = useMemo(
    () => [
      { id: "create", title: "Création", hint: "Lier élève, classe et année." },
      { id: "list", title: "Suivi", hint: "Filtrer et gérer les inscriptions.", done: enrollments.length > 0 }
    ],
    [enrollments.length]
  );

  return {
    deleteEnrollment,
    enrollmentErrors,
    enrollmentFilters,
    enrollmentForm,
    enrollments,
    enrollmentSteps,
    enrollmentWorkflowStep,
    loadEnrollments,
    resetEnrollmentFilters,
    setEnrollmentFilters,
    setEnrollmentForm,
    setEnrollmentWorkflowStep,
    submitEnrollment
  };
};
