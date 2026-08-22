export const PARENT_RELATION_CODES = [
  "PERE",
  "MERE",
  "TUTEUR",
  "RESPONSABLE_LEGAL",
  "AUTRE",
] as const;

export type ParentRelationCode = (typeof PARENT_RELATION_CODES)[number];
