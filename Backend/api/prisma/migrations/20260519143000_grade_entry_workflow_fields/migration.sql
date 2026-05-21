ALTER TABLE "grades"
  ADD COLUMN "assessment_date" DATE,
  ADD COLUMN "coefficient" DECIMAL(5, 2) NOT NULL DEFAULT 1,
  ADD COLUMN "exempted" BOOLEAN NOT NULL DEFAULT false;
