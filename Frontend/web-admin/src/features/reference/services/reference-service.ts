import type { ClassItem, Cycle, Level, Period, SchoolYear, Subject } from "../../../shared/types/app";
import { parseApiError } from "../../../shared/services/api-errors";
import type { ReferenceApiClient, ReferenceData } from "../types/reference";

export const emptyReferenceData = (): ReferenceData => ({
  schoolYears: [],
  cycles: [],
  levels: [],
  classes: [],
  subjects: [],
  periods: []
});

export const parseReferenceError = parseApiError;

export const fetchReferenceData = async (
  api: ReferenceApiClient
): Promise<{ data: ReferenceData; errors: string[] }> => {
  const [schoolYearsResponse, cyclesResponse, levelsResponse, classesResponse, subjectsResponse, periodsResponse] =
    await Promise.all([
      api("/school-years"),
      api("/cycles"),
      api("/levels"),
      api("/classes"),
      api("/subjects"),
      api("/academic-periods")
    ]);

  const errors: string[] = [];
  const data = emptyReferenceData();

  if (schoolYearsResponse.ok) {
    data.schoolYears = (await schoolYearsResponse.json()) as SchoolYear[];
  } else {
    errors.push(await parseReferenceError(schoolYearsResponse));
  }

  if (cyclesResponse.ok) {
    data.cycles = (await cyclesResponse.json()) as Cycle[];
  } else {
    errors.push(await parseReferenceError(cyclesResponse));
  }

  if (levelsResponse.ok) {
    data.levels = (await levelsResponse.json()) as Level[];
  } else {
    errors.push(await parseReferenceError(levelsResponse));
  }

  if (classesResponse.ok) {
    data.classes = (await classesResponse.json()) as ClassItem[];
  } else {
    errors.push(await parseReferenceError(classesResponse));
  }

  if (subjectsResponse.ok) {
    data.subjects = (await subjectsResponse.json()) as Subject[];
  } else {
    errors.push(await parseReferenceError(subjectsResponse));
  }

  if (periodsResponse.ok) {
    data.periods = (await periodsResponse.json()) as Period[];
  } else {
    errors.push(await parseReferenceError(periodsResponse));
  }

  return { data, errors };
};

export const createReferenceItem = async (
  api: ReferenceApiClient,
  path: string,
  payload: unknown
): Promise<void> => {
  const response = await api(path, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parseReferenceError(response));
  }
};

export const deleteReferenceItem = async (api: ReferenceApiClient, path: string): Promise<void> => {
  const response = await api(path, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await parseReferenceError(response));
  }
};
