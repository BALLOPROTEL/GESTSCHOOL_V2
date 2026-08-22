export const normalizeIdentityText = (value?: string): string =>
  value?.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr") ?? "";

export const normalizeEmail = (value?: string): string =>
  value?.trim().toLocaleLowerCase("en") ?? "";

export const normalizePhone = (value?: string): string =>
  value?.replace(/\D/g, "") ?? "";

export const normalizeMatricule = (value?: string): string =>
  value?.trim().toLocaleUpperCase("en") ?? "";

export const maskPhone = (value?: string | null): string | null => {
  const normalized = normalizePhone(value ?? undefined);
  if (!normalized) return null;
  return normalized.length <= 4
    ? normalized
    : `${"*".repeat(Math.min(6, normalized.length - 4))}${normalized.slice(-4)}`;
};

export const maskEmail = (value?: string | null): string | null => {
  const normalized = normalizeEmail(value ?? undefined);
  if (!normalized) return null;
  const [local, domain] = normalized.split("@");
  if (!domain) return null;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${local.length > visible.length ? "***" : ""}@${domain}`;
};

export const maskIdentifier = (value?: string | null): string | null => {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  return normalized.length <= 4
    ? normalized
    : `${"*".repeat(Math.min(8, normalized.length - 4))}${normalized.slice(-4)}`;
};
