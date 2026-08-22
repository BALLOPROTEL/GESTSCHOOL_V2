import { isUiMessageToken, UI_MESSAGES, type UiMessageToken } from "../i18n";

type ParseApiErrorOptions = {
  localApiHint?: UiMessageToken;
};

const API_ERROR_CODES: Record<string, UiMessageToken> = {
  AUTH_INVALID_CREDENTIALS: UI_MESSAGES.invalidCredentials,
  AUTH_SESSION_EXPIRED: UI_MESSAGES.authenticationRequired,
  BAD_REQUEST: UI_MESSAGES.badRequest,
  CONFLICT: UI_MESSAGES.conflict,
  ENTITY_DELETE_LINKED_ACCOUNT: UI_MESSAGES.deleteLinkedAccount,
  ENTITY_DELETE_RESTRICTED: UI_MESSAGES.deleteRestricted,
  ENTITY_REQUIRES_ARCHIVE: UI_MESSAGES.archiveRequired,
  FORBIDDEN: UI_MESSAGES.forbidden,
  INTERNAL_ERROR: UI_MESSAGES.serverError,
  NOT_FOUND: UI_MESSAGES.notFound,
  RATE_LIMITED: UI_MESSAGES.rateLimited,
  REFERENCE_CLASS_IN_USE: UI_MESSAGES.classInUse,
  REFERENCE_CYCLE_IN_USE: UI_MESSAGES.cycleInUse,
  REFERENCE_LEVEL_IN_USE: UI_MESSAGES.levelInUse,
  REFERENCE_PERIOD_IN_USE: UI_MESSAGES.periodInUse,
  REFERENCE_SCHOOL_YEAR_IN_USE: UI_MESSAGES.schoolYearInUse,
  REFERENCE_SUBJECT_IN_USE: UI_MESSAGES.subjectInUse,
  UNAUTHORIZED: UI_MESSAGES.authenticationRequired,
  USER_DELETE_SELF_FORBIDDEN: UI_MESSAGES.deleteSelf,
  VALIDATION_ERROR: UI_MESSAGES.validationError
};

const LEGACY_MESSAGE_CODES: Record<string, UiMessageToken> = {
  "Academic period cannot be deleted because it is still used.": UI_MESSAGES.periodInUse,
  "Class cannot be deleted because it is still used.": UI_MESSAGES.classInUse,
  "Cycle cannot be deleted because it is still used.": UI_MESSAGES.cycleInUse,
  "Invalid refresh token.": UI_MESSAGES.authenticationRequired,
  "Invalid username or password.": UI_MESSAGES.invalidCredentials,
  "Level cannot be deleted because it is still used.": UI_MESSAGES.levelInUse,
  "School year cannot be deleted because it is still used.": UI_MESSAGES.schoolYearInUse,
  "Subject cannot be deleted because it is still used.": UI_MESSAGES.subjectInUse,
  "Token de réinitialisation invalide ou expiré.": UI_MESSAGES.resetLinkInvalid
};

const statusMessage = (status: number): UiMessageToken => {
  if (status === 400 || status === 422) return UI_MESSAGES.badRequest;
  if (status === 401) return UI_MESSAGES.authenticationRequired;
  if (status === 403) return UI_MESSAGES.forbidden;
  if (status === 404) return UI_MESSAGES.notFound;
  if (status === 409) return UI_MESSAGES.conflict;
  if (status === 429) return UI_MESSAGES.rateLimited;
  if (status >= 500) return UI_MESSAGES.serverError;
  return UI_MESSAGES.unexpectedError;
};

export const parseApiError = async (
  response: Response,
  options: ParseApiErrorOptions = {}
): Promise<UiMessageToken> => {
  try {
    const payload = (await response.json()) as { code?: unknown; message?: unknown };
    if (typeof payload.code === "string" && API_ERROR_CODES[payload.code]) {
      return API_ERROR_CODES[payload.code];
    }
    if (typeof payload.message === "string" && LEGACY_MESSAGE_CODES[payload.message.trim()]) {
      return LEGACY_MESSAGE_CODES[payload.message.trim()];
    }
  } catch {
    // The HTTP status still provides a safe, localizable fallback.
  }

  if (response.status >= 500 && options.localApiHint) return options.localApiHint;
  return statusMessage(response.status);
};

export const toUiErrorMessage = (
  error: unknown,
  fallback: UiMessageToken = UI_MESSAGES.unexpectedError
): UiMessageToken => {
  if (error instanceof Error && isUiMessageToken(error.message)) return error.message;
  return fallback;
};
