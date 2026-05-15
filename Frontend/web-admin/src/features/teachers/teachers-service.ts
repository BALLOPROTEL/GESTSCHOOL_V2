import { parseApiError } from "../../shared/services/api-errors";
import type {
  TeacherDetailRecord,
  TeacherDocumentRecord,
  TeacherPedagogicalAssignment,
  TeacherRecord,
  TeacherSkillRecord,
  TeacherWorkloadRecord
} from "../../shared/types/app";

type ApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type TeacherFilters = {
  search: string;
  status: string;
  teacherType: string;
  subjectId: string;
  classId: string;
  track: string;
};

export type TeacherPayload = Record<string, string | number | boolean | undefined>;

export type TeacherDocumentUploadDescriptor = {
  driver: string;
  tenantId: string;
  fileName: string;
  mimeType: string;
  key: string;
  uploadUrl: string;
  fileUrl: string;
  expiresAt: string;
  bucket?: string;
  token?: string;
};

export type TeacherDocumentUploadPayload = {
  fileName: string;
  mimeType: string;
  size: number;
};

export type TeachersModuleData = {
  teachers: TeacherRecord[];
  skills: TeacherSkillRecord[];
  assignments: TeacherPedagogicalAssignment[];
  documents: TeacherDocumentRecord[];
  workloads: TeacherWorkloadRecord[];
};

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as T;
};

const toQueryString = (values: Record<string, string | undefined>): string => {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return query.toString();
};

export const fetchTeachers = async (api: ApiClient, filters: TeacherFilters): Promise<TeacherRecord[]> => {
  const query = toQueryString(filters);
  return readJson<TeacherRecord[]>(await api(`/teachers${query ? `?${query}` : ""}`));
};

export const fetchTeachersModule = async (
  api: ApiClient,
  schoolYearId?: string
): Promise<TeachersModuleData> => {
  const workloadQuery = schoolYearId ? `?schoolYearId=${encodeURIComponent(schoolYearId)}` : "";
  const [teachersResponse, skillsResponse, assignmentsResponse, documentsResponse, workloadsResponse] =
    await Promise.all([
      api("/teachers"),
      api("/teachers/skills"),
      api("/teachers/assignments"),
      api("/teachers/documents"),
      api(`/teachers/workloads${workloadQuery}`)
    ]);

  return {
    teachers: await readJson<TeacherRecord[]>(teachersResponse),
    skills: await readJson<TeacherSkillRecord[]>(skillsResponse),
    assignments: await readJson<TeacherPedagogicalAssignment[]>(assignmentsResponse),
    documents: await readJson<TeacherDocumentRecord[]>(documentsResponse),
    workloads: await readJson<TeacherWorkloadRecord[]>(workloadsResponse)
  };
};

export const fetchTeacherDetail = async (api: ApiClient, teacherId: string): Promise<TeacherDetailRecord> =>
  readJson<TeacherDetailRecord>(await api(`/teachers/${teacherId}`));

export const saveTeacher = async (
  api: ApiClient,
  teacherId: string | null,
  payload: TeacherPayload
): Promise<TeacherRecord> => {
  const response = await api(teacherId ? `/teachers/${teacherId}` : "/teachers", {
    method: teacherId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return readJson<TeacherRecord>(response);
};

export const createTeacherSkill = async (api: ApiClient, payload: TeacherPayload): Promise<TeacherSkillRecord> =>
  readJson<TeacherSkillRecord>(
    await api("/teachers/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  );

export const createTeacherAssignment = async (
  api: ApiClient,
  payload: TeacherPayload
): Promise<TeacherPedagogicalAssignment> =>
  readJson<TeacherPedagogicalAssignment>(
    await api("/teachers/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  );

export const createTeacherDocument = async (
  api: ApiClient,
  payload: TeacherPayload
): Promise<TeacherDocumentRecord> =>
  readJson<TeacherDocumentRecord>(
    await api("/teachers/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  );

export const createTeacherDocumentUploadDescriptor = async (
  api: ApiClient,
  teacherId: string,
  payload: TeacherDocumentUploadPayload
): Promise<TeacherDocumentUploadDescriptor> =>
  readJson<TeacherDocumentUploadDescriptor>(
    await api(`/teachers/${teacherId}/documents/upload-descriptor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  );

export const uploadTeacherDocumentFile = async (
  descriptor: TeacherDocumentUploadDescriptor,
  file: File
): Promise<void> => {
  const response = await fetch(descriptor.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || descriptor.mimeType || "application/octet-stream" },
    body: file
  });
  if (!response.ok) {
    throw new Error("L'envoi du document a échoué.");
  }
};

export const deleteTeacherResource = async (api: ApiClient, path: string): Promise<void> => {
  const response = await api(path, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseApiError(response));
};
