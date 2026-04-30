import type { AcademicTrack } from "../../shared/types/app";

export type RoomForm = {
  code: string;
  name: string;
  building: string;
  floor: string;
  location: string;
  description: string;
  roomTypeId: string;
  capacity: string;
  examCapacity: string;
  status: string;
  isSharedBetweenCurricula: boolean;
  defaultTrack: "" | AcademicTrack;
  establishmentId: string;
  notes: string;
};

export type RoomAssignmentForm = {
  roomId: string;
  schoolYearId: string;
  classId: string;
  levelId: string;
  cycleId: string;
  track: "" | AcademicTrack;
  subjectId: string;
  periodId: string;
  assignmentType: string;
  startDate: string;
  endDate: string;
  status: string;
  comment: string;
};

export type RoomAvailabilityForm = {
  roomId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  availabilityType: string;
  schoolYearId: string;
  periodId: string;
  comment: string;
};

export type RoomTypeForm = {
  code: string;
  name: string;
  description: string;
  status: string;
};

export type RoomFilters = {
  search: string;
  status: string;
  roomTypeId: string;
  track: string;
  minCapacity: string;
};

export const ROOM_STATUSES = ["ACTIVE", "INACTIVE", "MAINTENANCE", "ARCHIVED"];
export const ROOM_TYPE_STATUSES = ["ACTIVE", "INACTIVE"];
export const ASSIGNMENT_STATUSES = ["ACTIVE", "INACTIVE", "COMPLETED", "ARCHIVED"];
export const ASSIGNMENT_TYPES = [
  "CLASS_HOME_ROOM",
  "SUBJECT_ROOM",
  "CURRICULUM_DEDICATED",
  "EXAM_ROOM",
  "SHARED_ROOM",
  "TEMPORARY_ASSIGNMENT"
];
export const AVAILABILITY_TYPES = ["AVAILABLE", "UNAVAILABLE", "MAINTENANCE", "RESERVED"];
export const TRACKS: AcademicTrack[] = ["FRANCOPHONE", "ARABOPHONE"];
export const SCHOOL_NAME = "Al Manarat Islamiyat";

export const trackLabel = (track?: AcademicTrack): string => {
  if (!track) return "Partage";
  return track === "ARABOPHONE" ? "Arabophone" : "Francophone";
};

export const assignmentTypeLabel = (value: string): string =>
  ({
    CLASS_HOME_ROOM: "Salle principale",
    SUBJECT_ROOM: "Salle matiere",
    CURRICULUM_DEDICATED: "Dediee cursus",
    EXAM_ROOM: "Salle examen",
    SHARED_ROOM: "Salle partagee",
    TEMPORARY_ASSIGNMENT: "Affectation temporaire"
  })[value] || value;

export const dayLabel = (day?: number): string =>
  day ? ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"][day] || String(day) : "Tous";

export const emptyToUndefined = (value: string): string | undefined => {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

export const numberOrUndefined = (value: string): number | undefined => {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const defaultRoomFilters = (): RoomFilters => ({
  search: "",
  status: "",
  roomTypeId: "",
  track: "",
  minCapacity: ""
});

export const defaultRoomForm = (): RoomForm => ({
  code: "",
  name: "",
  building: "",
  floor: "",
  location: "",
  description: "",
  roomTypeId: "",
  capacity: "30",
  examCapacity: "",
  status: "ACTIVE",
  isSharedBetweenCurricula: true,
  defaultTrack: "",
  establishmentId: "",
  notes: ""
});

export const defaultAssignmentForm = (): RoomAssignmentForm => ({
  roomId: "",
  schoolYearId: "",
  classId: "",
  levelId: "",
  cycleId: "",
  track: "",
  subjectId: "",
  periodId: "",
  assignmentType: "CLASS_HOME_ROOM",
  startDate: "",
  endDate: "",
  status: "ACTIVE",
  comment: ""
});

export const defaultAvailabilityForm = (): RoomAvailabilityForm => ({
  roomId: "",
  dayOfWeek: "",
  startTime: "",
  endTime: "",
  availabilityType: "AVAILABLE",
  schoolYearId: "",
  periodId: "",
  comment: ""
});

export const defaultRoomTypeForm = (): RoomTypeForm => ({
  code: "",
  name: "",
  description: "",
  status: "ACTIVE"
});
