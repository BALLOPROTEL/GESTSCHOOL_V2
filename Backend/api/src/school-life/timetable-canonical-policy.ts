type TimetableCanonicalRefs = {
  roomId?: string | null;
  teacherAssignmentId?: string | null;
};

type TimetableLegacyFields = {
  room?: string | null;
  teacherName?: string | null;
};

export function getMissingTimetableCanonicalRefs({
  roomId,
  teacherAssignmentId
}: TimetableCanonicalRefs): string[] {
  return [
    roomId ? undefined : "roomId",
    teacherAssignmentId ? undefined : "teacherAssignmentId"
  ].filter((item): item is string => Boolean(item));
}

export function getProvidedTimetableLegacyFields({
  room,
  teacherName
}: TimetableLegacyFields): string[] {
  return [
    room?.trim() ? "room" : undefined,
    teacherName?.trim() ? "teacherName" : undefined
  ].filter((item): item is string => Boolean(item));
}

export function formatTimetableCanonicalRefsError(
  missingRefs: string[],
  legacyFields: string[]
): string {
  const missing = missingRefs.join(", ");
  const legacyHint =
    legacyFields.length > 0
      ? ` Legacy text fields (${legacyFields.join(", ")}) are compatibility mirrors only.`
      : "";

  return `Timetable canonical references are required before cutover: ${missing}.${legacyHint}`;
}
