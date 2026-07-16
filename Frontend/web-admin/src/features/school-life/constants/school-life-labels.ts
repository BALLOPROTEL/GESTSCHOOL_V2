export const dayLabels = new Map<number, string>([
  [1, "Lundi"],
  [2, "Mardi"],
  [3, "Mercredi"],
  [4, "Jeudi"],
  [5, "Vendredi"],
  [6, "Samedi"],
  [7, "Dimanche"]
]);

export const attendanceStatusLabels: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Retard",
  EXCUSED: "Excuse"
};

export const validationStatusLabels: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Validee",
  REJECTED: "Rejetee"
};

export const notificationStatusLabels: Record<string, string> = {
  PENDING: "En attente",
  PROCESSING: "En cours",
  SENT: "Envoyee",
  DELIVERED: "Livree",
  FAILED_RETRYABLE: "Nouvelle tentative",
  FAILED_PERMANENT: "Echec permanent",
  DEAD_LETTER: "Intervention requise",
  CANCELLED: "Annulee"
};

export const notificationDeliveryLabels: Record<string, string> = {
  PENDING: "En attente",
  PROCESSING: "En cours",
  SENT: "Transmise",
  DELIVERED: "Livree",
  FAILED_RETRYABLE: "Nouvelle tentative",
  FAILED_PERMANENT: "Echec permanent",
  DEAD_LETTER: "Intervention requise",
  CANCELLED: "Annulee"
};

export const notificationChannelLabels: Record<string, string> = {
  IN_APP: "Application",
  EMAIL: "E-mail",
  SMS: "SMS"
};

export const notificationAudienceLabels: Record<string, string> = {
  PARENT: "Parents",
  ENSEIGNANT: "Enseignants",
  ADMIN: "Administration",
  SCOLARITE: "Scolarite",
  COMPTABLE: "Comptabilite"
};

export const labelFromMap = (map: Record<string, string>, value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  return map[normalized] || value || "-";
};
