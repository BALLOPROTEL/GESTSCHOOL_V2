import { parseApiError } from "../../shared/services/api-errors";
import type { ParentRecord, ParentStudentRelation } from "../../shared/types/app";

type ApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type ParentPayload = Record<string, string | boolean | undefined>;
export type ParentLinkPayload = Record<string, string | boolean | undefined>;

export type ParentsModuleData = {
  parents: ParentRecord[];
  relations: ParentStudentRelation[];
};

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as T;
};

export const fetchParentsModule = async (api: ApiClient): Promise<ParentsModuleData> => {
  const [parentsResponse, linksResponse] = await Promise.all([
    api("/parents"),
    api("/parents/links")
  ]);

  return {
    parents: await readJson<ParentRecord[]>(parentsResponse),
    relations: await readJson<ParentStudentRelation[]>(linksResponse)
  };
};

export const saveParent = async (
  api: ApiClient,
  parentId: string | null,
  payload: ParentPayload
): Promise<ParentRecord> => {
  const response = await api(parentId ? `/parents/${parentId}` : "/parents", {
    method: parentId ? "PATCH" : "POST",
    body: JSON.stringify(payload)
  });
  return readJson<ParentRecord>(response);
};

export const archiveParentRecord = async (api: ApiClient, parentId: string): Promise<void> => {
  const response = await api(`/parents/${parentId}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseApiError(response));
};

export const createParentStudentLink = async (
  api: ApiClient,
  payload: ParentLinkPayload
): Promise<ParentStudentRelation> => {
  const response = await api("/parents/links", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return readJson<ParentStudentRelation>(response);
};

export const archiveParentStudentLink = async (api: ApiClient, linkId: string): Promise<void> => {
  const response = await api(`/parents/links/${linkId}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseApiError(response));
};
