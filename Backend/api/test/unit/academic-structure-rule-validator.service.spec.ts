import { ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AcademicTrack, RotationGroup } from "@prisma/client";

import { AcademicStructureRuleValidator } from "../../src/academic-structure/academic-structure-rule-validator.service";

describe("AcademicStructureRuleValidator", () => {
  let validator: AcademicStructureRuleValidator;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AcademicStructureRuleValidator]
    }).compile();

    validator = moduleRef.get(AcademicStructureRuleValidator);
  });

  it("allows weekly rules when the day is authorized for the track", () => {
    expect(() =>
      validator.validateWeeklyTrackRule(
        { daysByTrack: { FRANCOPHONE: [1, 2, 3] } },
        AcademicTrack.FRANCOPHONE,
        2,
        "Alternance hebdomadaire"
      )
    ).not.toThrow();
  });

  it("rejects weekly slots outside the configured days for the track", () => {
    expect(() =>
      validator.validateWeeklyTrackRule(
        { daysByTrack: { ARABOPHONE: [4, 5] } },
        AcademicTrack.ARABOPHONE,
        2,
        "Alternance hebdomadaire"
      )
    ).toThrow(ConflictException);
  });

  it("rejects rotation slots when the half-day schedule expects another track", () => {
    expect(() =>
      validator.validateParallelRotationRule(
        { schedule: { MORNING: { GROUP_A: "AR" } } },
        AcademicTrack.FRANCOPHONE,
        RotationGroup.GROUP_A,
        "08:30",
        "Rotation parallele"
      )
    ).toThrow(ConflictException);
  });
});
