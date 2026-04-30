import type {
  ParentRecord,
  Role,
  RolePermissionView,
  TeacherRecord,
  UserAccount
} from "../../../shared/types/app";
import type { IamApiClient } from "../types/iam";

export const parseIamError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // Keep a stable fallback when the API returns an empty or non-JSON error body.
  }
  return `Erreur HTTP ${response.status}`;
};

export const fetchIamUsers = async (api: IamApiClient): Promise<UserAccount[]> => {
  const response = await api("/users");
  if (!response.ok) {
    throw new Error(await parseIamError(response));
  }
  return (await response.json()) as UserAccount[];
};

export const fetchIamAccountReferences = async (
  api: IamApiClient
): Promise<{ teachers: TeacherRecord[]; parents: ParentRecord[] }> => {
  const [teachersResponse, parentsResponse] = await Promise.all([
    api("/teachers"),
    api("/parents")
  ]);

  if (!teachersResponse.ok) {
    throw new Error(await parseIamError(teachersResponse));
  }
  if (!parentsResponse.ok) {
    throw new Error(await parseIamError(parentsResponse));
  }

  return {
    teachers: (await teachersResponse.json()) as TeacherRecord[],
    parents: (await parentsResponse.json()) as ParentRecord[]
  };
};

export const fetchRolePermissions = async (
  api: IamApiClient,
  role: Role
): Promise<RolePermissionView[]> => {
  const response = await api(`/users/roles/${encodeURIComponent(role)}/permissions`);
  if (!response.ok) {
    throw new Error(await parseIamError(response));
  }
  return (await response.json()) as RolePermissionView[];
};

export const saveRolePermissions = async (
  api: IamApiClient,
  role: Role,
  permissions: Array<{ resource: string; action: string; allowed: boolean }>
): Promise<RolePermissionView[]> => {
  const response = await api(`/users/roles/${encodeURIComponent(role)}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissions })
  });

  if (!response.ok) {
    throw new Error(await parseIamError(response));
  }

  return (await response.json()) as RolePermissionView[];
};

export const upsertIamUser = async (
  api: IamApiClient,
  editingUserId: string | null,
  payload: Record<string, unknown>
): Promise<UserAccount> => {
  const response = await api(editingUserId ? `/users/${editingUserId}` : "/users", {
    method: editingUserId ? "PATCH" : "POST",
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseIamError(response));
  }

  return (await response.json()) as UserAccount;
};

export const removeIamUser = async (api: IamApiClient, id: string): Promise<void> => {
  const response = await api(`/users/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await parseIamError(response));
  }
};
