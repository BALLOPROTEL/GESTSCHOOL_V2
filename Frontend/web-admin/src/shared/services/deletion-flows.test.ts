import { describe, expect, it, vi } from "vitest";

import { archiveParentRecord, archiveParentStudentLink } from "../../features/parents/parents-service";
import { archiveRoomResource, deleteRoomResource } from "../../features/rooms/rooms-service";
import { archiveStudent } from "../../features/students/services/students-service";
import {
  archiveTeacherResource,
  deleteTeacherResource
} from "../../features/teachers/teachers-service";

const successfulApi = () => vi.fn(async () => new Response(null, { status: 204 }));

describe("explicit deletion and archive API flows", () => {
  it("uses explicit archive routes for student and parent records", async () => {
    const api = successfulApi();

    await archiveStudent(api, "student-id");
    await archiveParentRecord(api, "parent-id");
    await archiveParentStudentLink(api, "link-id");

    expect(api).toHaveBeenNthCalledWith(1, "/students/student-id/archive", { method: "POST" });
    expect(api).toHaveBeenNthCalledWith(2, "/parents/parent-id/archive", { method: "POST" });
    expect(api).toHaveBeenNthCalledWith(3, "/parents/links/link-id/archive", { method: "POST" });
  });

  it("keeps teacher and room archive calls distinct from physical deletes", async () => {
    const api = successfulApi();

    await archiveTeacherResource(api, "/teachers/teacher-id/archive");
    await deleteTeacherResource(api, "/teachers/skills/skill-id");
    await archiveRoomResource(api, "/rooms/room-id/archive");
    await deleteRoomResource(api, "/rooms/availabilities/availability-id");

    expect(api).toHaveBeenNthCalledWith(1, "/teachers/teacher-id/archive", { method: "POST" });
    expect(api).toHaveBeenNthCalledWith(2, "/teachers/skills/skill-id", { method: "DELETE" });
    expect(api).toHaveBeenNthCalledWith(3, "/rooms/room-id/archive", { method: "POST" });
    expect(api).toHaveBeenNthCalledWith(4, "/rooms/availabilities/availability-id", {
      method: "DELETE"
    });
  });
});
