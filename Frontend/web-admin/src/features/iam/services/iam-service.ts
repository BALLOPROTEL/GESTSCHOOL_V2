import { parseApiError } from "../../../shared/services/api-errors";
import type {
  ParentRecord,
  Role,
  RolePermissionView,
  TeacherRecord,
  UserAccount
} from "../../../shared/types/app";
import type { IamApiClient } from "../types/iam";

export const parseIamError = parseApiError;

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

export const sendIamUserActivation = async (
  api: IamApiClient,
  id: string
): Promise<{ message: string; sent: boolean }> => {
  const response = await api(`/users/${id}/send-activation`, { method: "POST" });
  if (!response.ok) {
    throw new Error(await parseIamError(response));
  }
  return (await response.json()) as { message: string; sent: boolean };
};
