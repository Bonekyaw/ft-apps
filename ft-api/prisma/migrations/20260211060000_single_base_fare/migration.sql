-- Replace base fare min/max and initial km with single baseFareMmkt
ALTER TABLE "pricing_defaults" ADD COLUMN "baseFareMmkt" DECIMAL(10,2);

UPDATE "pricing_defaults" SET "baseFareMmkt" = "baseFareMinMmkt" WHERE "baseFareMinMmkt" IS NOT NULL;
UPDATE "pricing_defaults" SET "baseFareMmkt" = 1500 WHERE "baseFareMmkt" IS NULL;

ALTER TABLE "pricing_defaults" ALTER COLUMN "baseFareMmkt" SET NOT NULL;

ALTER TABLE "pricing_defaults" DROP COLUMN "baseFareMinMmkt",
  DROP COLUMN "baseFareMaxMmkt",
  DROP COLUMN "initialKmForBase";
