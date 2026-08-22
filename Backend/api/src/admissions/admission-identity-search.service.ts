import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { type ParentRelationCode } from "../parents/parent-relations";
import {
  maskEmail,
  maskIdentifier,
  maskPhone,
  normalizeEmail,
  normalizeIdentityText,
  normalizeMatricule,
  normalizePhone,
} from "../common/identity-normalization";
import {
  type AdmissionGuardianSearchResult,
  type AdmissionStudentSearchResult,
} from "./admission-cases.types";
import {
  AdmissionGuardianSearchQueryDto,
  AdmissionStudentSearchQueryDto,
} from "./dto/admission-identity-search.dto";

type StudentCandidate = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  phone: string | null;
  email: string | null;
  status: string;
};

type GuardianCandidate = {
  id: string;
  parentalRole: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  email: string | null;
  identityDocumentType: string | null;
  identityDocumentNumber: string | null;
  status: string;
};

@Injectable()
export class AdmissionIdentitySearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchStudents(
    tenantId: string,
    query: AdmissionStudentSearchQueryDto,
  ): Promise<AdmissionStudentSearchResult> {
    const matricule = normalizeMatricule(query.matricule);
    const firstName = normalizeIdentityText(query.firstName);
    const lastName = normalizeIdentityText(query.lastName);
    const phone = normalizePhone(query.phone);
    const email = normalizeEmail(query.email);
    if (!matricule && !firstName && !lastName && !phone && !email) {
      throw this.criteriaRequired();
    }

    const conditions: Prisma.Sql[] = [];
    if (matricule) {
      conditions.push(Prisma.sql`upper(btrim("matricule")) = ${matricule}`);
    }
    if (firstName) {
      conditions.push(
        Prisma.sql`lower(regexp_replace(btrim("first_name"), '\\s+', ' ', 'g')) = ${firstName}`,
      );
    }
    if (lastName) {
      conditions.push(
        Prisma.sql`lower(regexp_replace(btrim("last_name"), '\\s+', ' ', 'g')) = ${lastName}`,
      );
    }
    if (phone) {
      conditions.push(
        Prisma.sql`regexp_replace(coalesce("phone", ''), '[^0-9]', '', 'g') = ${phone}`,
      );
    }
    if (email) {
      conditions.push(
        Prisma.sql`lower(btrim(coalesce("email", ''))) = ${email}`,
      );
    }

    const rows = await this.prisma.$queryRaw<StudentCandidate[]>(Prisma.sql`
      SELECT
        "id",
        "matricule",
        "first_name" AS "firstName",
        "last_name" AS "lastName",
        "birth_date" AS "birthDate",
        "phone",
        "email",
        "status"
      FROM "students"
      WHERE "tenant_id" = ${tenantId}::uuid
        AND "deleted_at" IS NULL
        AND "archived_at" IS NULL
        AND (${Prisma.join(conditions, " OR ")})
      ORDER BY "last_name", "first_name", "id"
      LIMIT ${query.limit}
    `);

    const requestedBirthDate = query.birthDate?.slice(0, 10) ?? "";
    const matches = rows
      .map((row) => {
        const signals: Array<
          "MATRICULE" | "IDENTITY_AND_BIRTH_DATE" | "NAME" | "PHONE" | "EMAIL"
        > = [];
        if (matricule && normalizeMatricule(row.matricule) === matricule) {
          signals.push("MATRICULE");
        }
        const namesMatch = Boolean(
          firstName &&
          lastName &&
          normalizeIdentityText(row.firstName) === firstName &&
          normalizeIdentityText(row.lastName) === lastName,
        );
        if (namesMatch) signals.push("NAME");
        if (
          namesMatch &&
          requestedBirthDate &&
          row.birthDate?.toISOString().slice(0, 10) === requestedBirthDate
        ) {
          signals.push("IDENTITY_AND_BIRTH_DATE");
        }
        if (phone && normalizePhone(row.phone ?? undefined) === phone) {
          signals.push("PHONE");
        }
        if (email && normalizeEmail(row.email ?? undefined) === email) {
          signals.push("EMAIL");
        }
        const exact = signals.includes("MATRICULE");
        const blocksCreation =
          exact ||
          signals.includes("IDENTITY_AND_BIRTH_DATE") ||
          signals.includes("PHONE") ||
          signals.includes("EMAIL");
        return {
          id: row.id,
          matchKind: exact
            ? ("EXACT_MATCH" as const)
            : ("POSSIBLE_MATCH" as const),
          signals,
          blocksCreation,
          matricule: row.matricule,
          firstName: row.firstName,
          lastName: row.lastName,
          birthDate: row.birthDate?.toISOString().slice(0, 10) ?? null,
          status: row.status,
          phoneHint: maskPhone(row.phone),
          emailHint: maskEmail(row.email),
        };
      })
      .filter((match) => match.signals.length > 0);

    if (matches.length === 0) {
      return { matchKind: "NO_MATCH", code: null, matches: [] };
    }
    const exact = matches.some((match) => match.matchKind === "EXACT_MATCH");
    const suspected = matches.some((match) => match.blocksCreation);
    return {
      matchKind: exact ? "EXACT_MATCH" : "POSSIBLE_MATCH",
      code: exact
        ? "STUDENT_EXACT_MATCH"
        : suspected
          ? "STUDENT_DUPLICATE_SUSPECTED"
          : null,
      matches,
    };
  }

  async searchGuardians(
    tenantId: string,
    query: AdmissionGuardianSearchQueryDto,
  ): Promise<AdmissionGuardianSearchResult> {
    const firstName = normalizeIdentityText(query.firstName);
    const lastName = normalizeIdentityText(query.lastName);
    const phone = normalizePhone(query.phone);
    const email = normalizeEmail(query.email);
    const documentNumber = normalizeIdentityText(query.identityDocumentNumber);
    const documentType = normalizeIdentityText(query.identityDocumentType);
    if (!firstName && !lastName && !phone && !email && !documentNumber) {
      throw this.criteriaRequired();
    }

    const conditions: Prisma.Sql[] = [];
    if (firstName) {
      conditions.push(
        Prisma.sql`lower(regexp_replace(btrim("first_name"), '\\s+', ' ', 'g')) = ${firstName}`,
      );
    }
    if (lastName) {
      conditions.push(
        Prisma.sql`lower(regexp_replace(btrim("last_name"), '\\s+', ' ', 'g')) = ${lastName}`,
      );
    }
    if (phone) {
      conditions.push(
        Prisma.sql`regexp_replace("primary_phone", '[^0-9]', '', 'g') = ${phone}`,
      );
    }
    if (email) {
      conditions.push(
        Prisma.sql`lower(btrim(coalesce("email", ''))) = ${email}`,
      );
    }
    if (documentNumber) {
      conditions.push(
        Prisma.sql`lower(btrim(coalesce("identity_document_number", ''))) = ${documentNumber}`,
      );
    }

    const rows = await this.prisma.$queryRaw<GuardianCandidate[]>(Prisma.sql`
      SELECT
        "id",
        "parental_role" AS "parentalRole",
        "first_name" AS "firstName",
        "last_name" AS "lastName",
        "primary_phone" AS "primaryPhone",
        "email",
        "identity_document_type" AS "identityDocumentType",
        "identity_document_number" AS "identityDocumentNumber",
        "status"
      FROM "parents"
      WHERE "tenant_id" = ${tenantId}::uuid
        AND "archived_at" IS NULL
        AND "status" = 'ACTIVE'
        AND (${Prisma.join(conditions, " OR ")})
      ORDER BY "last_name", "first_name", "id"
      LIMIT ${query.limit}
    `);

    const matches = rows
      .map((row) => {
        const signals: Array<"IDENTITY_DOCUMENT" | "PHONE" | "EMAIL" | "NAME"> =
          [];
        const namesMatch = Boolean(
          firstName &&
          lastName &&
          normalizeIdentityText(row.firstName) === firstName &&
          normalizeIdentityText(row.lastName) === lastName,
        );
        if (namesMatch) signals.push("NAME");
        if (phone && normalizePhone(row.primaryPhone) === phone)
          signals.push("PHONE");
        if (email && normalizeEmail(row.email ?? undefined) === email)
          signals.push("EMAIL");
        if (
          documentNumber &&
          normalizeIdentityText(row.identityDocumentNumber ?? undefined) ===
            documentNumber &&
          (!documentType ||
            normalizeIdentityText(row.identityDocumentType ?? undefined) ===
              documentType)
        ) {
          signals.push("IDENTITY_DOCUMENT");
        }
        return {
          id: row.id,
          matchKind: "POSSIBLE_MATCH" as const,
          signals,
          blocksCreation:
            signals.includes("IDENTITY_DOCUMENT") ||
            signals.includes("PHONE") ||
            signals.includes("EMAIL"),
          firstName: row.firstName,
          lastName: row.lastName,
          parentalRole: row.parentalRole as ParentRelationCode,
          status: row.status,
          phoneHint: maskPhone(row.primaryPhone) ?? "",
          emailHint: maskEmail(row.email),
          identityDocumentType: row.identityDocumentType,
          identityDocumentHint: maskIdentifier(row.identityDocumentNumber),
        };
      })
      .filter((match) => match.signals.length > 0);

    if (matches.length === 0) {
      return { matchKind: "NO_MATCH", code: null, matches: [] };
    }
    return {
      matchKind: "POSSIBLE_MATCH",
      code: matches.some((match) => match.blocksCreation)
        ? "GUARDIAN_DUPLICATE_SUSPECTED"
        : null,
      matches,
    };
  }

  private criteriaRequired(): BadRequestException {
    return new BadRequestException({
      code: "ADMISSION_SEARCH_CRITERIA_REQUIRED",
      message: "At least one admission identity search criterion is required.",
    });
  }
}
