import type {
  UserActivityItem,
  UserSessionItem,
  UserSelfProfile
} from "../../shared/types/app";
import { parseApiError } from "../../shared/services/api-errors";

export type ProfileApiClient = (
  path: string,
  init?: RequestInit,
  retry?: boolean,
  options?: { background?: boolean; forceProbe?: boolean }
) => Promise<Response>;

export type UpdateProfilePayload = {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  language?: string;
  theme?: string;
  emailNotificationsEnabled?: boolean;
  systemNotificationsEnabled?: boolean;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export const parseProfileError = parseApiError;

export const fetchMyProfile = async (api: ProfileApiClient): Promise<UserSelfProfile> => {
  const response = await api("/users/me", undefined, true, { background: true });
  if (!response.ok) {
    throw new Error(await parseProfileError(response));
  }
  return (await response.json()) as UserSelfProfile;
};

export const updateMyProfile = async (
  api: ProfileApiClient,
  payload: UpdateProfilePayload
): Promise<UserSelfProfile> => {
  const response = await api("/users/me/profile", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parseProfileError(response));
  }
  return (await response.json()) as UserSelfProfile;
};

export const uploadMyAvatar = async (
  api: ProfileApiClient,
  file: File
): Promise<UserSelfProfile> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api("/users/me/avatar", {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw new Error(await parseProfileError(response));
  }
  return (await response.json()) as UserSelfProfile;
};

export const removeMyAvatar = async (api: ProfileApiClient): Promise<UserSelfProfile> => {
  const response = await api("/users/me/avatar", {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error(await parseProfileError(response));
  }
  return (await response.json()) as UserSelfProfile;
};

export const changeMyPassword = async (
  api: ProfileApiClient,
  payload: ChangePasswordPayload
): Promise<void> => {
  const response = await api("/users/me/change-password", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parseProfileError(response));
  }
};

export const fetchMyActivity = async (api: ProfileApiClient): Promise<UserActivityItem[]> => {
  const response = await api("/users/me/activity", undefined, true, { background: true });
  if (!response.ok) {
    throw new Error(await parseProfileError(response));
  }
  return (await response.json()) as UserActivityItem[];
};

export const fetchMySessions = async (api: ProfileApiClient): Promise<UserSessionItem[]> => {
  const response = await api("/users/me/sessions", undefined, true, { background: true });
  if (!response.ok) {
    throw new Error(await parseProfileError(response));
  }
  return (await response.json()) as UserSessionItem[];
};

export const logoutAllMySessions = async (
  api: ProfileApiClient
): Promise<{ message: string; revokedSessions: number }> => {
  const response = await api("/users/me/logout-all-devices", {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(await parseProfileError(response));
  }
  return (await response.json()) as { message: string; revokedSessions: number };
};
