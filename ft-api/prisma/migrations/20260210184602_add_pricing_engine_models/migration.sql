-- CreateEnum
CREATE TYPE "PricingRuleType" AS ENUM ('DISTANCE_BAND', 'TIME_OF_DAY', 'SPECIAL_DAY');

-- CreateTable
CREATE TABLE "pricing_defaults" (
    "id" TEXT NOT NULL,
    "baseFareMinMmkt" DECIMAL(10,2) NOT NULL,
    "baseFareMaxMmkt" DECIMAL(10,2) NOT NULL,
    "initialKmForBase" DECIMAL(4,2) NOT NULL,
    "perKmRateDefaultMmkt" DECIMAL(10,2) NOT NULL,
    "taxiPlusMultiplier" DECIMAL(3,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MMK',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "ruleType" "PricingRuleType" NOT NULL,
    "minDistanceKm" DECIMAL(6,2),
    "maxDistanceKm" DECIMAL(6,2),
    "perKmRateMmkt" DECIMAL(10,2),
    "startHour" INTEGER,
    "endHour" INTEGER,
    "timeSurgeMultiplier" DECIMAL(3,2),
    "dayOfWeek" INTEGER,
    "isWeekend" BOOLEAN,
    "isHoliday" BOOLEAN,
    "holidayDate" TIMESTAMP(3),
    "specialDayMultiplier" DECIMAL(3,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_quote" (
    "id" TEXT NOT NULL,
    "pickupLat" DECIMAL(10,8) NOT NULL,
    "pickupLng" DECIMAL(11,8) NOT NULL,
    "dropoffLat" DECIMAL(10,8) NOT NULL,
    "dropoffLng" DECIMAL(11,8) NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "encodedPolyline" TEXT NOT NULL,
    "standardFareMmkt" DECIMAL(10,2) NOT NULL,
    "taxiPlusFareMmkt" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MMK',
    "rideId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_quote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pricing_rule_active_priority_idx" ON "pricing_rule"("active", "priority");

-- CreateIndex
CREATE INDEX "route_quote_createdAt_idx" ON "route_quote"("createdAt");
