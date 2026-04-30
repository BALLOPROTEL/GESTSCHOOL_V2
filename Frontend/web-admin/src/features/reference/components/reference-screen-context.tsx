import { createContext, useContext } from "react";

import type { ClassItem, Cycle, Level, Period, SchoolYear } from "../../../shared/types/app";
import type { useReferenceScreenState } from "../hooks/use-reference-screen-state";
import type { ReferenceData } from "../types/reference";

type ReferenceState = ReturnType<typeof useReferenceScreenState>;

export type ReferenceScreenContextValue = ReferenceState &
  ReferenceData & {
    activeSchoolYear?: SchoolYear;
    classCycleOptions: Cycle[];
    cycleById: Map<string, Cycle>;
    defaultSchoolYearId: string;
    formatSubjectCycles: (levelIds?: string[]) => string;
    formatSubjectLevels: (levelIds?: string[]) => string;
    levelById: Map<string, Level>;
    periodParents: Period[];
    schoolFieldValue: string;
    schoolName: string;
    schoolYearById: Map<string, SchoolYear>;
    selectedClassCycle?: Cycle;
    selectedClassCycleId: string;
    selectedClassLevel?: Level;
    selectedLevelSchoolYearId: string;
    selectedPeriodSchoolYear?: SchoolYear;
    subjectAvailableLevels: Level[];
    classes: ClassItem[];
  };

const ReferenceScreenContext = createContext<ReferenceScreenContextValue | null>(null);

export const ReferenceScreenContextProvider = ReferenceScreenContext.Provider;

export const useReferenceScreenContext = (): ReferenceScreenContextValue => {
  const value = useContext(ReferenceScreenContext);
  if (!value) {
    throw new Error("useReferenceScreenContext must be used inside ReferenceScreenContextProvider.");
  }
  return value;
};
