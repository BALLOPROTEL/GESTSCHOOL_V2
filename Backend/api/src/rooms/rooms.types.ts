import {
  AcademicTrack,
  Prisma,
  type Room,
  type RoomAssignment,
  type RoomAvailability,
  type RoomType
} from "@prisma/client";

export type RoomFilters = {
  search?: string;
  status?: string;
  roomTypeId?: string;
  track?: AcademicTrack;
  minCapacity?: number;
  schoolYearId?: string;
  includeArchived?: string;
};

export type AssignmentFilters = {
  roomId?: string;
  schoolYearId?: string;
  classId?: string;
  subjectId?: string;
  track?: AcademicTrack;
  status?: string;
};

export type RoomWithRelations = Prisma.RoomGetPayload<{ include: { roomType: true; assignments: true } }>;
export type AssignmentWithRelations = Prisma.RoomAssignmentGetPayload<{
  include: {
    room: true;
    schoolYear: true;
    classroom: true;
    level: true;
    cycle: true;
    subject: true;
    academicPeriod: true;
  };
}>;
export type AvailabilityWithRelations = Prisma.RoomAvailabilityGetPayload<{
  include: { room: true; schoolYear: true; academicPeriod: true };
}>;

export type RoomTypeView = {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomView = {
  id: string;
  code: string;
  name: string;
  building?: string;
  floor?: string;
  location?: string;
  description?: string;
  roomTypeId: string;
  roomTypeName?: string;
  capacity: number;
  examCapacity?: number;
  status: string;
  isSharedBetweenCurricula: boolean;
  defaultTrack?: AcademicTrack;
  establishmentId?: string;
  notes?: string;
  activeAssignmentsCount: number;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomAssignmentView = {
  id: string;
  roomId: string;
  roomLabel?: string;
  schoolYearId: string;
  schoolYearCode?: string;
  classId?: string;
  classLabel?: string;
  levelId?: string;
  levelLabel?: string;
  cycleId?: string;
  cycleLabel?: string;
  track?: AcademicTrack;
  subjectId?: string;
  subjectLabel?: string;
  periodId?: string;
  periodLabel?: string;
  assignmentType: string;
  startDate?: string;
  endDate?: string;
  status: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomAvailabilityView = {
  id: string;
  roomId: string;
  roomLabel?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  availabilityType: string;
  schoolYearId?: string;
  schoolYearCode?: string;
  periodId?: string;
  periodLabel?: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomDetailView = RoomView & {
  assignments: RoomAssignmentView[];
  availabilities: RoomAvailabilityView[];
};

export type RoomOccupancyView = {
  roomId: string;
  roomLabel: string;
  roomTypeName?: string;
  capacity: number;
  status: string;
  defaultTrack?: AcademicTrack;
  isSharedBetweenCurricula: boolean;
  assignmentsCount: number;
  francophoneAssignmentsCount: number;
  arabophoneAssignmentsCount: number;
  sharedAssignmentsCount: number;
  classes: string[];
  subjects: string[];
};

export type RoomEntity = Room;
export type RoomTypeEntity = RoomType;
export type RoomAssignmentEntity = RoomAssignment;
export type RoomAvailabilityEntity = RoomAvailability;
