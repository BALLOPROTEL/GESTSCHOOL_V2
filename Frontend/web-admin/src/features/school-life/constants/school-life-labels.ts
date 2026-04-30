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
  SCHEDULED: "Planifiee",
  SENT: "Envoyee",
  FAILED: "Echec"
};

export const notificationDeliveryLabels: Record<string, string> = {
  QUEUED: "En file",
  SENT_TO_PROVIDER: "Transmise",
  DELIVERED: "Livree",
  RETRYING: "Nouvelle tentative",
  FAILED: "Echec",
  UNDELIVERABLE: "Non distribuable"
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
