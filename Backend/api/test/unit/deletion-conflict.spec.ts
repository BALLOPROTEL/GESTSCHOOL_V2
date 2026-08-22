import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  DELETION_ERROR_CODES,
  deletionConflict,
  rethrowDeleteConstraint
} from "../../src/common/deletion-conflict";

describe("deletion conflict contract", () => {
  it("returns stable conflict payloads", () => {
    const error = deletionConflict(DELETION_ERROR_CODES.restricted, "Internal detail");

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toEqual({
      code: "ENTITY_DELETE_RESTRICTED",
      message: "Internal detail"
    });
  });

  it("maps PostgreSQL foreign-key races to a stable 409", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
      code: "P2003",
      clientVersion: "6.19.3"
    });

    expect(() => rethrowDeleteConstraint(error, "Retained history")).toThrow(ConflictException);
    try {
      rethrowDeleteConstraint(error, "Retained history");
    } catch (conflict: unknown) {
      expect((conflict as ConflictException).getResponse()).toMatchObject({
        code: "ENTITY_DELETE_RESTRICTED"
      });
    }
  });

  it("does not hide unrelated Prisma failures", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Unique conflict", {
      code: "P2002",
      clientVersion: "6.19.3"
    });

    expect(rethrowDeleteConstraint(error, "Retained history")).toBeUndefined();
  });
});
