import type { ClassItem, Cycle, Level, Period, SchoolYear, Subject } from "../../../shared/types/app";
import type { ReferenceApiClient, ReferenceData } from "../types/reference";

export const emptyReferenceData = (): ReferenceData => ({
  schoolYears: [],
  cycles: [],
  levels: [],
  classes: [],
  subjects: [],
  periods: []
});

export const parseReferenceError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // Keep the original response available for the generic HTTP fallback.
  }
  return `Erreur HTTP ${response.status}`;
};

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
    errors.push(`Annees: ${await parseReferenceError(schoolYearsResponse)}`);
  }

  if (cyclesResponse.ok) {
    data.cycles = (await cyclesResponse.json()) as Cycle[];
  } else {
    errors.push(`Cycles: ${await parseReferenceError(cyclesResponse)}`);
  }

  if (levelsResponse.ok) {
    data.levels = (await levelsResponse.json()) as Level[];
  } else {
    errors.push(`Niveaux: ${await parseReferenceError(levelsResponse)}`);
  }

  if (classesResponse.ok) {
    data.classes = (await classesResponse.json()) as ClassItem[];
  } else {
    errors.push(`Classes: ${await parseReferenceError(classesResponse)}`);
  }

  if (subjectsResponse.ok) {
    data.subjects = (await subjectsResponse.json()) as Subject[];
  } else {
    errors.push(`Matieres: ${await parseReferenceError(subjectsResponse)}`);
  }

  if (periodsResponse.ok) {
    data.periods = (await periodsResponse.json()) as Period[];
  } else {
    errors.push(`Periodes: ${await parseReferenceError(periodsResponse)}`);
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
