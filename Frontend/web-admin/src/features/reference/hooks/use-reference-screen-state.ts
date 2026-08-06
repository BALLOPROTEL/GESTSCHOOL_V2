import { useCallback, useEffect, useMemo, useState } from "react";

import { UI_MESSAGES } from "../../../shared/i18n";
import { toUiErrorMessage } from "../../../shared/services/api-errors";
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
      onError(errors[0] || UI_MESSAGES.loadError);
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

  const createRef = useCallback(
    async (path: string, payload: unknown): Promise<boolean> => {
      clearReferenceFieldErrors(path);
      onError(null);

      if (!remoteEnabled) {
        onNotice(UI_MESSAGES.previewNotPersisted);
        return false;
      }

      try {
        await createReferenceItem(api, path, payload);
      } catch (error) {
        onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
        return false;
      }

      onNotice(UI_MESSAGES.created);
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
    ]
  );

  const deleteRef = useCallback(
    async (path: string): Promise<void> => {
      onError(null);

      if (!remoteEnabled) {
        onNotice(UI_MESSAGES.previewNotPersisted);
        return;
      }

      try {
        await deleteReferenceItem(api, path);
        onNotice(UI_MESSAGES.deleted);
        await refreshReferenceData();
        await onReloadEnrollments?.();
      } catch (error) {
        onError(toUiErrorMessage(error, UI_MESSAGES.deleteError));
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
