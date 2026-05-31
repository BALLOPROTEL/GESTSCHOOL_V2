import {
  formatTimetableCanonicalRefsError,
  getMissingTimetableCanonicalRefs,
  getProvidedTimetableLegacyFields
} from "../../src/school-life/timetable-canonical-policy";

describe("timetable canonical policy", () => {
  it("reports missing canonical references before cutover", () => {
    expect(
      getMissingTimetableCanonicalRefs({
        roomId: null,
        teacherAssignmentId: "assignment-id"
      })
    ).toEqual(["roomId"]);
  });

  it("detects legacy text fields that should only remain display mirrors", () => {
    expect(
      getProvidedTimetableLegacyFields({
        room: " Salle texte ",
        teacherName: "Nom enseignant"
      })
    ).toEqual(["room", "teacherName"]);
  });

  it("explains that legacy timetable fields are not active source-of-truth fields", () => {
    expect(
      formatTimetableCanonicalRefsError(
        ["roomId", "teacherAssignmentId"],
        ["room", "teacherName"]
      )
    ).toBe(
      "Timetable canonical references are required before cutover: roomId, teacherAssignmentId. Legacy text fields (room, teacherName) are compatibility mirrors only."
    );
  });
});
