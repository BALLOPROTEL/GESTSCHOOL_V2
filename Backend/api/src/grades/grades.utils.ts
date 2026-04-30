import { Prisma } from "@prisma/client";

export function decimalToNumber(value: Prisma.Decimal | number | null): number {
  if (value === null) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return Number(value.toString());
}

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function resolveAppreciation(average: number): string {
  if (average >= 16) {
    return "EXCELLENT";
  }
  if (average >= 14) {
    return "TRES BIEN";
  }
  if (average >= 12) {
    return "BIEN";
  }
  if (average >= 10) {
    return "PASSABLE";
  }
  if (average >= 8) {
    return "FAIBLE";
  }
  return "MEDIOCRE";
}
