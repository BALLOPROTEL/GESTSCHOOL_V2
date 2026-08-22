import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export const DELETION_ERROR_CODES = {
  archiveRequired: "ENTITY_REQUIRES_ARCHIVE",
  linkedAccount: "ENTITY_DELETE_LINKED_ACCOUNT",
  restricted: "ENTITY_DELETE_RESTRICTED",
  self: "USER_DELETE_SELF_FORBIDDEN"
} as const;

export const deletionConflict = (
  code: (typeof DELETION_ERROR_CODES)[keyof typeof DELETION_ERROR_CODES],
  message: string
): ConflictException => new ConflictException({ code, message });

export const rethrowDeleteConstraint = (error: unknown, message: string): void => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    throw deletionConflict(DELETION_ERROR_CODES.restricted, message);
  }
};
