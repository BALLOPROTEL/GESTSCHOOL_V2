type ParseApiErrorOptions = {
  localApiHint?: string;
};

const normalizeApiMessage = (message: string): string => {
  const normalized = message.trim();
  const knownMessages: Record<string, string> = {
    "Invalid username or password.": "Identifiant ou mot de passe incorrect.",
    "Invalid refresh token.": "Session expirée. Reconnectez-vous.",
    "Token de réinitialisation invalide ou expiré.": "Lien de réinitialisation invalide ou expiré."
  };
  return knownMessages[normalized] || normalized;
};

export const parseApiError = async (
  response: Response,
  options: ParseApiErrorOptions = {}
): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.map(normalizeApiMessage).join(", ");
    if (typeof payload.message === "string") return normalizeApiMessage(payload.message);
    if (typeof payload.error === "string") return normalizeApiMessage(payload.error);
  } catch {
    // Keep the original HTTP signal when the API does not return JSON.
  }

  if (response.status >= 500 && options.localApiHint) return options.localApiHint;
  return `Erreur HTTP ${response.status}`;
};
