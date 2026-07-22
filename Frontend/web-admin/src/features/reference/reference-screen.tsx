import type { JSX } from "react";

import { WorkflowGuide } from "../../shared/components/workflow-guide";
import type { WorkflowStepDef } from "../../shared/types/app";
import { ClassesSection } from "./components/classes-section";
import { CyclesSection } from "./components/cycles-section";
import { LevelsSection } from "./components/levels-section";
import { PeriodsSection } from "./components/periods-section";
import {
  ReferenceScreenContextProvider,
  type ReferenceScreenContextValue
} from "./components/reference-screen-context";
import { SchoolYearsSection } from "./components/school-years-section";
import { SubjectsSection } from "./components/subjects-section";
import { useReferenceScreenState } from "./hooks/use-reference-screen-state";
import type { ReferenceApiClient, ReferenceData } from "./types/reference";
import { useI18n } from "../../shared/i18n-context";


type ReferenceScreenProps = {
  api: ReferenceApiClient;
  data: ReferenceData;
  schoolName: string;
  remoteEnabled?: boolean;
  onDataChange: (data: ReferenceData) => void;
  onReloadEnrollments?: () => Promise<void>;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

export function ReferenceScreen({
  api,
  data,
  schoolName,
  remoteEnabled = true,
  onDataChange,
  onReloadEnrollments,
  onError,
  onNotice
}: ReferenceScreenProps): JSX.Element {
  const { t: tr } = useI18n();
  const { schoolYears, cycles, levels, classes, subjects, periods } = data;
  const state = useReferenceScreenState({
    api,
    data,
    remoteEnabled,
    onDataChange,
    onReloadEnrollments,
    onError,
    onNotice
  });

  const schoolYearById = new Map(schoolYears.map((item) => [item.id, item]));
  const levelById = new Map(levels.map((item) => [item.id, item]));
  const cycleById = new Map(cycles.map((item) => [item.id, item]));
  const activeSchoolYear = schoolYears.find((item) => item.status === "ACTIVE") || schoolYears.find((item) => item.isActive);
  const defaultSchoolYearId = activeSchoolYear?.id || schoolYears[0]?.id || "";
  const selectedLevelCycle = cycleById.get(state.levelForm.cycleId);
  const selectedLevelSchoolYearId = selectedLevelCycle?.schoolYearId || defaultSchoolYearId;
  const selectedClassLevel = levelById.get(state.classForm.levelId);
  const selectedClassCycle = selectedClassLevel ? cycleById.get(selectedClassLevel.cycleId) : undefined;
  const selectedClassCycleId = selectedClassCycle?.id || "";
  const classCycleOptions = state.classForm.schoolYearId
    ? cycles.filter((item) => item.schoolYearId === state.classForm.schoolYearId)
    : cycles;
  const selectedPeriodSchoolYear = schoolYearById.get(state.periodForm.schoolYearId);
  const periodParents = state.periodForm.schoolYearId
    ? periods.filter((item) => item.schoolYearId === state.periodForm.schoolYearId)
    : periods;
  const subjectAvailableLevels = state.subjectCycleScope
    ? levels.filter((item) => item.cycleId === state.subjectCycleScope)
    : levels;

  const formatSubjectLevels = (levelIds: string[] = []): string => {
    const labels = levelIds
      .map((levelId) => levelById.get(levelId)?.label)
      .filter((value): value is string => Boolean(value));
    return labels.length > 0 ? labels.join(", ") : "-";
  };

  const formatSubjectCycles = (levelIds: string[] = []): string => {
    const labels = Array.from(
      new Set(
        levelIds
          .map((levelId) => levelById.get(levelId))
          .map((level) => (level ? cycleById.get(level.cycleId)?.label : undefined))
          .filter((value): value is string => Boolean(value))
      )
    );
    return labels.length > 0 ? labels.join(", ") : "-";
  };

  const referenceSteps: WorkflowStepDef[] = [
    { id: "years", title: "Annees", hint: "Base temporelle du referentiel.", done: schoolYears.length > 0 },
    { id: "cycles", title: "Cycles", hint: "Regrouper les parcours.", done: cycles.length > 0 },
    { id: "levels", title: "Niveaux", hint: "Structurer les classes pedagogiques.", done: levels.length > 0 },
    { id: "classes", title: "Classes", hint: "Creer les classes reelles.", done: classes.length > 0 },
    { id: "periods", title: "Periodes", hint: "Decouper l'annee.", done: periods.length > 0 },
    { id: "subjects", title: "Matieres", hint: "Cataloguer les disciplines.", done: subjects.length > 0 }
  ];

  const selectReferencePage = (stepId: string): void => {
    state.setReferenceWorkflowStep(stepId);
    window.setTimeout(() => {
      document.getElementById("reference-workflow")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const renderReferencePage = (): JSX.Element => {
    switch (state.referenceWorkflowStep) {
      case "cycles":
        return <CyclesSection />;
      case "levels":
        return <LevelsSection />;
      case "classes":
        return <ClassesSection />;
      case "periods":
        return <PeriodsSection />;
      case "subjects":
        return <SubjectsSection />;
      case "years":
      default:
        return <SchoolYearsSection />;
    }
  };

  const contextValue: ReferenceScreenContextValue = {
    ...data,
    ...state,
    activeSchoolYear,
    classCycleOptions,
    cycleById,
    defaultSchoolYearId,
    formatSubjectCycles,
    formatSubjectLevels,
    levelById,
    periodParents,
    schoolFieldValue: schoolName,
    schoolName,
    schoolYearById,
    selectedClassCycle,
    selectedClassCycleId,
    selectedClassLevel,
    selectedLevelSchoolYearId,
    selectedPeriodSchoolYear,
    subjectAvailableLevels
  };

  return (
    <ReferenceScreenContextProvider value={contextValue}>
      <div className="reference-shell">
        <div id="reference-workflow" className="reference-workflow-shell">
          <WorkflowGuide
            className="module-v3-workflow"
            title={tr("Referentiel academique")}
            steps={referenceSteps}
            activeStepId={state.referenceWorkflowStep}
            onStepChange={selectReferencePage}
          >
            {renderReferencePage()}
          </WorkflowGuide>
        </div>
      </div>
    </ReferenceScreenContextProvider>
  );
}
