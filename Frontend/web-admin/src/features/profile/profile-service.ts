import type {
  UserActivityItem,
  UserSessionItem,
  UserSelfProfile
} from "../../shared/types/app";

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

const isMissingProfileRouteMessage = (message: string): boolean =>
  /^Cannot (GET|POST|PATCH|DELETE) \/api\/v1\/users\/me/u.test(message);

const PROFILE_DEPLOYMENT_ERROR =
  "Le service profil n’est pas encore disponible sur l’API déployée. Vérifiez la configuration API puis réessayez.";

export const parseProfileError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    if (typeof payload.message === "string") {
      if (response.status === 404 && isMissingProfileRouteMessage(payload.message)) {
        return PROFILE_DEPLOYMENT_ERROR;
      }
      return payload.message;
    }
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // Keep a stable fallback for non-JSON API errors.
  }
  return `Erreur HTTP ${response.status}`;
};

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
): Promise<string> => {
  const response = await api("/users/me/change-password", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parseProfileError(response));
  }
  const body = (await response.json()) as { message?: string };
  return body.message || "Mot de passe modifié avec succès.";
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
