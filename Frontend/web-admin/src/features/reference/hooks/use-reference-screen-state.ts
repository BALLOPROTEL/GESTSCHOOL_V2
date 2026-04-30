import { useCallback, useEffect, useMemo, useState } from "react";

import type { FieldErrors } from "../../../shared/types/app";
import {
  createReferenceItem,
  deleteReferenceItem,
  fetchReferenceData
} from "../services/reference-service";
import type {
  ClassForm,
  CycleForm,
  LevelForm,
  PeriodForm,
  ReferenceApiClient,
  ReferenceData,
  SchoolYearForm,
  SubjectForm
} from "../types/reference";

type ReferenceErrorTarget = {
  scope: "schoolYear" | "cycle" | "level" | "class" | "subject" | "period";
  field: string;
};

type UseReferenceScreenStateOptions = {
  api: ReferenceApiClient;
  data: ReferenceData;
  remoteEnabled?: boolean;
  onDataChange: (data: ReferenceData) => void;
  onReloadEnrollments?: () => Promise<void>;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

const buildSchoolYearForm = (): SchoolYearForm => ({
  code: "",
  label: "",
  startDate: "",
  endDate: "",
  status: "DRAFT",
  previousYearId: "",
  isDefault: false,
  sortOrder: "",
  comment: ""
});

const buildCycleForm = (): CycleForm => ({
  schoolYearId: "",
  code: "",
  label: "",
  academicStage: "PRIMARY",
  sortOrder: 1,
  description: "",
  theoreticalAgeMin: "",
  theoreticalAgeMax: "",
  status: "ACTIVE"
});

const buildLevelForm = (): LevelForm => ({
  cycleId: "",
  code: "",
  label: "",
  sortOrder: 1,
  track: "FRANCOPHONE",
  alias: "",
  status: "ACTIVE",
  theoreticalAge: "",
  description: "",
  defaultSection: ""
});

const buildClassForm = (): ClassForm => ({
  schoolYearId: "",
  levelId: "",
  code: "",
  label: "",
  capacity: "",
  track: "FRANCOPHONE",
  status: "ACTIVE",
  homeroomTeacherName: "",
  mainRoom: "",
  actualCapacity: "",
  filiere: "",
  series: "",
  speciality: "",
  description: "",
  teachingMode: "PRESENTIAL"
});

const buildSubjectForm = (): SubjectForm => ({
  code: "",
  label: "",
  status: "ACTIVE",
  nature: "FRANCOPHONE",
  shortLabel: "",
  defaultCoefficient: "",
  category: "",
  description: "",
  color: "#16a34a",
  weeklyHours: "",
  isGraded: true,
  isOptional: false,
  levelIds: []
});

const buildPeriodForm = (): PeriodForm => ({
  schoolYearId: "",
  code: "",
  label: "",
  startDate: "",
  endDate: "",
  periodType: "TRIMESTER",
  sortOrder: 1,
  status: "ACTIVE",
  parentPeriodId: "",
  isGradeEntryOpen: false,
  gradeEntryDeadline: "",
  lockDate: "",
  comment: ""
});

const getReferenceFieldErrorTarget = (path: string, message: string): ReferenceErrorTarget | null => {
  const normalized = message.trim().toLowerCase();

  if (path === "/school-years" && normalized.includes("already exists")) {
    return {
      scope: "schoolYear",
      field: normalized.includes("label") ? "label" : normalized.includes("active") ? "status" : "code"
    };
  }
  if (path === "/school-years" && normalized.includes("previous school year")) {
    return { scope: "schoolYear", field: "previousYearId" };
  }
  if (path === "/cycles" && normalized.includes("already exists")) {
    return { scope: "cycle", field: normalized.includes("label") ? "label" : "code" };
  }
  if (path === "/cycles" && normalized.includes("age")) {
    return { scope: "cycle", field: normalized.includes("max") ? "theoreticalAgeMax" : "theoreticalAgeMin" };
  }
  if (path === "/levels" && normalized.includes("already exists")) {
    return { scope: "level", field: normalized.includes("label") ? "label" : "code" };
  }
  if (path === "/classes" && normalized.includes("already exists")) {
    return { scope: "class", field: normalized.includes("label") ? "label" : "code" };
  }
  if (path === "/classes" && normalized.includes("maximum capacity")) {
    return { scope: "class", field: "capacity" };
  }
  if (path === "/classes" && normalized.includes("actual class capacity")) {
    return { scope: "class", field: "actualCapacity" };
  }
  if (path === "/subjects" && normalized.includes("already exists")) {
    return { scope: "subject", field: normalized.includes("label") ? "label" : "code" };
  }
  if (path === "/subjects" && normalized.includes("coefficient")) {
    return { scope: "subject", field: "defaultCoefficient" };
  }
  if (path === "/subjects" && normalized.includes("weekly hours")) {
    return { scope: "subject", field: "weeklyHours" };
  }
  if (path === "/subjects" && normalized.includes("level scope")) {
    return { scope: "subject", field: "levelIds" };
  }
  if (path === "/academic-periods" && normalized.includes("already exists")) {
    return { scope: "period", field: normalized.includes("label") ? "label" : "code" };
  }
  if (path === "/academic-periods" && normalized.includes("deadline")) {
    return { scope: "period", field: "gradeEntryDeadline" };
  }
  if (path === "/academic-periods" && normalized.includes("lock date")) {
    return { scope: "period", field: "lockDate" };
  }
  if (path === "/academic-periods" && normalized.includes("parent academic period")) {
    return { scope: "period", field: "parentPeriodId" };
  }
  if (path === "/academic-periods" && normalized.includes("overlaps")) {
    return { scope: "period", field: "startDate" };
  }
  if (normalized.includes("required")) {
    return path === "/academic-periods"
      ? { scope: "period", field: "label" }
      : path === "/subjects"
        ? { scope: "subject", field: "label" }
        : null;
  }

  return null;
};

export const useReferenceScreenState = ({
  api,
  data,
  remoteEnabled = true,
  onDataChange,
  onReloadEnrollments,
  onError,
  onNotice
}: UseReferenceScreenStateOptions) => {
  const { schoolYears, cycles, levels, classes, periods } = data;
  const [referenceWorkflowStep, setReferenceWorkflowStep] = useState("years");
  const [levelCycleFilter, setLevelCycleFilter] = useState("");
  const [classYearFilter, setClassYearFilter] = useState("");
  const [classLevelFilter, setClassLevelFilter] = useState("");
  const [periodYearFilter, setPeriodYearFilter] = useState("");
  const [subjectCycleScope, setSubjectCycleScope] = useState("");
  const [syForm, setSyForm] = useState<SchoolYearForm>(() => buildSchoolYearForm());
  const [cycleForm, setCycleForm] = useState<CycleForm>(() => buildCycleForm());
  const [levelForm, setLevelForm] = useState<LevelForm>(() => buildLevelForm());
  const [classForm, setClassForm] = useState<ClassForm>(() => buildClassForm());
  const [subjectForm, setSubjectForm] = useState<SubjectForm>(() => buildSubjectForm());
  const [periodForm, setPeriodForm] = useState<PeriodForm>(() => buildPeriodForm());
  const [schoolYearErrors, setSchoolYearErrors] = useState<FieldErrors>({});
  const [cycleErrors, setCycleErrors] = useState<FieldErrors>({});
  const [levelErrors, setLevelErrors] = useState<FieldErrors>({});
  const [classErrors, setClassErrors] = useState<FieldErrors>({});
  const [subjectErrors, setSubjectErrors] = useState<FieldErrors>({});
  const [periodErrors, setPeriodErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!cycleForm.schoolYearId && schoolYears[0]) {
      setCycleForm((previous) => ({ ...previous, schoolYearId: schoolYears[0].id }));
    }
    if (!levelForm.cycleId && cycles[0]) {
      setLevelForm((previous) => ({ ...previous, cycleId: cycles[0].id }));
    }
    if (!classForm.schoolYearId && schoolYears[0]) {
      setClassForm((previous) => ({ ...previous, schoolYearId: schoolYears[0].id }));
    }
    if (!classForm.levelId && levels[0]) {
      setClassForm((previous) => ({ ...previous, levelId: levels[0].id }));
    }
    if (!periodForm.schoolYearId && schoolYears[0]) {
      setPeriodForm((previous) => ({ ...previous, schoolYearId: schoolYears[0].id }));
    }
  }, [
    classForm.levelId,
    classForm.schoolYearId,
    cycleForm.schoolYearId,
    cycles,
    levelForm.cycleId,
    levels,
    periodForm.schoolYearId,
    schoolYears
  ]);

  useEffect(() => {
    const selectedLevel = levels.find((item) => item.id === classForm.levelId);
    if (selectedLevel && classForm.track !== selectedLevel.track) {
      setClassForm((previous) => ({ ...previous, track: selectedLevel.track }));
    }
  }, [classForm.levelId, classForm.track, levels]);

  const shownLevels = useMemo(
    () => (levelCycleFilter ? levels.filter((item) => item.cycleId === levelCycleFilter) : levels),
    [levelCycleFilter, levels]
  );
  const shownClasses = useMemo(
    () =>
      classes.filter((item) => {
        const yearMatches = !classYearFilter || item.schoolYearId === classYearFilter;
        const levelMatches = !classLevelFilter || item.levelId === classLevelFilter;
        return yearMatches && levelMatches;
      }),
    [classLevelFilter, classYearFilter, classes]
  );
  const shownPeriods = useMemo(
    () => (periodYearFilter ? periods.filter((item) => item.schoolYearId === periodYearFilter) : periods),
    [periodYearFilter, periods]
  );

  const refreshReferenceData = useCallback(async (): Promise<void> => {
    const { data: nextData, errors } = await fetchReferenceData(api);
    onDataChange(nextData);
    if (errors.length > 0) {
      onError(errors.join(" | "));
    }
  }, [api, onDataChange, onError]);

  const clearReferenceFieldErrors = useCallback((path: string): void => {
    if (path === "/school-years") setSchoolYearErrors({});
    if (path === "/cycles") setCycleErrors({});
    if (path === "/levels") setLevelErrors({});
    if (path === "/classes") setClassErrors({});
    if (path === "/subjects") setSubjectErrors({});
    if (path === "/academic-periods") setPeriodErrors({});
  }, []);

  const setReferenceFieldError = useCallback((target: ReferenceErrorTarget, message: string): void => {
    const nextErrors = { [target.field]: message };
    if (target.scope === "schoolYear") setSchoolYearErrors(nextErrors);
    if (target.scope === "cycle") setCycleErrors(nextErrors);
    if (target.scope === "level") setLevelErrors(nextErrors);
    if (target.scope === "class") setClassErrors(nextErrors);
    if (target.scope === "subject") setSubjectErrors(nextErrors);
    if (target.scope === "period") setPeriodErrors(nextErrors);
  }, []);

  const createRef = useCallback(
    async (path: string, payload: unknown, message: string): Promise<boolean> => {
      clearReferenceFieldErrors(path);
      onError(null);

      if (!remoteEnabled) {
        onNotice("Mode apercu local : referentiel non persiste.");
        return false;
      }

      try {
        await createReferenceItem(api, path, payload);
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Erreur de creation du referentiel.";
        const target = getReferenceFieldErrorTarget(path, messageText);
        if (target) {
          setReferenceFieldError(target, messageText);
        }
        onError(messageText);
        return false;
      }

      onNotice(message);
      await refreshReferenceData();
      await onReloadEnrollments?.();
      return true;
    },
    [
      api,
      clearReferenceFieldErrors,
      onError,
      onNotice,
      onReloadEnrollments,
      refreshReferenceData,
      remoteEnabled,
      setReferenceFieldError
    ]
  );

  const deleteRef = useCallback(
    async (path: string, message: string): Promise<void> => {
      onError(null);

      if (!remoteEnabled) {
        onNotice("Mode apercu local : suppression non persistee.");
        return;
      }

      try {
        await deleteReferenceItem(api, path);
        onNotice(message);
        await refreshReferenceData();
        await onReloadEnrollments?.();
      } catch (error) {
        onError(error instanceof Error ? error.message : "Erreur de suppression du referentiel.");
      }
    },
    [api, onError, onNotice, onReloadEnrollments, refreshReferenceData, remoteEnabled]
  );

  return {
    classErrors,
    classForm,
    classLevelFilter,
    classYearFilter,
    createRef,
    cycleErrors,
    cycleForm,
    deleteRef,
    levelCycleFilter,
    levelErrors,
    levelForm,
    periodErrors,
    periodForm,
    periodYearFilter,
    referenceWorkflowStep,
    schoolYearErrors,
    setClassErrors,
    setClassForm,
    setClassLevelFilter,
    setClassYearFilter,
    setCycleErrors,
    setCycleForm,
    setLevelCycleFilter,
    setLevelErrors,
    setLevelForm,
    setPeriodErrors,
    setPeriodForm,
    setPeriodYearFilter,
    setReferenceWorkflowStep,
    setSchoolYearErrors,
    setSubjectCycleScope,
    setSubjectErrors,
    setSubjectForm,
    setSyForm,
    shownClasses,
    shownLevels,
    shownPeriods,
    subjectCycleScope,
    subjectErrors,
    subjectForm,
    syForm
  };
};
