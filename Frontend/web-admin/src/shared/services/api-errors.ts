type ParseApiErrorOptions = {
  localApiHint?: string;
};

export const parseApiError = async (
  response: Response,
  options: ParseApiErrorOptions = {}
): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // Keep the original HTTP signal when the API does not return JSON.
  }

  if (response.status >= 500 && options.localApiHint) return options.localApiHint;
  return `Erreur HTTP ${response.status}`;
};
