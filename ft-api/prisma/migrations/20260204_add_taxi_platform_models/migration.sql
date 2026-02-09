-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'DRIVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('OFFLINE', 'ONLINE', 'ON_TRIP');

-- CreateEnum
CREATE TYPE "DriverApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('ECONOMY', 'COMFORT', 'PREMIUM', 'XL', 'MOTORBIKE');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CancellationReason" AS ENUM ('USER_CANCELLED', 'DRIVER_CANCELLED', 'NO_DRIVERS_AVAILABLE', 'DRIVER_NOT_FOUND', 'PAYMENT_FAILED', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'WALLET');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- AlterTable: Add phone column to user
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- AlterTable: Convert role from string to enum
-- First drop the default, then convert, then re-add default
ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "user" ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'USER'::"UserRole";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_phone_key" ON "user"("phone");
CREATE INDEX IF NOT EXISTS "user_role_idx" ON "user"("role");

-- CreateTable
CREATE TABLE "driver" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DriverStatus" NOT NULL DEFAULT 'OFFLINE',
    "approvalStatus" "DriverApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "licenseNumber" TEXT,
    "licenseExpiry" TIMESTAMP(3),
    "nationalId" TEXT,
    "licenseImageUrl" TEXT,
    "nationalIdImageUrl" TEXT,
    "totalRides" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "averageRating" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL DEFAULT 'ECONOMY',
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "registrationNumber" TEXT,
    "registrationExpiry" TIMESTAMP(3),
    "insuranceNumber" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "vehicleImageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_location" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "heading" DECIMAL(5,2),
    "speed" DECIMAL(5,2),
    "accuracy" DECIMAL(6,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "driverId" TEXT,
    "status" "RideStatus" NOT NULL DEFAULT 'PENDING',
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'ECONOMY',
    "pickupAddress" TEXT NOT NULL,
    "pickupLat" DECIMAL(10,8) NOT NULL,
    "pickupLng" DECIMAL(11,8) NOT NULL,
    "dropoffAddress" TEXT NOT NULL,
    "dropoffLat" DECIMAL(10,8) NOT NULL,
    "dropoffLng" DECIMAL(11,8) NOT NULL,
    "distanceMeters" INTEGER,
    "durationSeconds" INTEGER,
    "polyline" TEXT,
    "baseFare" DECIMAL(10,2) NOT NULL,
    "distanceFare" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "timeFare" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "surgeFare" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "surgeMultiplier" DECIMAL(3,2) NOT NULL DEFAULT 1,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalFare" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" "CancellationReason",
    "cancelledBy" TEXT,
    "passengerNote" TEXT,
    "driverNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "paymentIntentId" TEXT,
    "driverPayout" DECIMAL(10,2) NOT NULL,
    "platformFee" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_payment_method" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT,
    "last4" TEXT,
    "brand" TEXT,
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_payment_method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_earning" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "type" TEXT NOT NULL,
    "description" TEXT,
    "rideId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_earning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "rateeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_location" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_config" (
    "id" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "baseFare" DECIMAL(10,2) NOT NULL,
    "perKmRate" DECIMAL(10,2) NOT NULL,
    "perMinuteRate" DECIMAL(10,2) NOT NULL,
    "minimumFare" DECIMAL(10,2) NOT NULL,
    "bookingFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surge_zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "centerLat" DECIMAL(10,8) NOT NULL,
    "centerLng" DECIMAL(11,8) NOT NULL,
    "radiusMeters" INTEGER NOT NULL,
    "multiplier" DECIMAL(3,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surge_zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_code" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "maxDiscount" DECIMAL(10,2),
    "minimumFare" DECIMAL(10,2),
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_code_usage" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rideId" TEXT,
    "discountApplied" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_code_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_userId_key" ON "driver"("userId");
CREATE INDEX "driver_status_idx" ON "driver"("status");
CREATE INDEX "driver_approvalStatus_idx" ON "driver"("approvalStatus");
CREATE INDEX "driver_status_approvalStatus_idx" ON "driver"("status", "approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_driverId_key" ON "vehicle"("driverId");
CREATE UNIQUE INDEX "vehicle_plateNumber_key" ON "vehicle"("plateNumber");
CREATE INDEX "vehicle_type_idx" ON "vehicle"("type");
CREATE INDEX "vehicle_isActive_idx" ON "vehicle"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "driver_location_driverId_key" ON "driver_location"("driverId");
CREATE INDEX "driver_location_latitude_longitude_idx" ON "driver_location"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "ride_passengerId_idx" ON "ride"("passengerId");
CREATE INDEX "ride_driverId_idx" ON "ride"("driverId");
CREATE INDEX "ride_status_idx" ON "ride"("status");
CREATE INDEX "ride_createdAt_idx" ON "ride"("createdAt");
CREATE INDEX "ride_status_createdAt_idx" ON "ride"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_rideId_key" ON "payment"("rideId");
CREATE INDEX "payment_status_idx" ON "payment"("status");
CREATE INDEX "payment_method_idx" ON "payment"("method");

-- CreateIndex
CREATE INDEX "user_payment_method_userId_idx" ON "user_payment_method"("userId");
CREATE INDEX "user_payment_method_userId_isDefault_idx" ON "user_payment_method"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "driver_earning_driverId_idx" ON "driver_earning"("driverId");
CREATE INDEX "driver_earning_driverId_createdAt_idx" ON "driver_earning"("driverId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "rating_rideId_key" ON "rating"("rideId");
CREATE INDEX "rating_raterId_idx" ON "rating"("raterId");
CREATE INDEX "rating_rateeId_idx" ON "rating"("rateeId");
CREATE INDEX "rating_rating_idx" ON "rating"("rating");

-- CreateIndex
CREATE INDEX "notification_userId_idx" ON "notification"("userId");
CREATE INDEX "notification_userId_isRead_idx" ON "notification"("userId", "isRead");
CREATE INDEX "notification_createdAt_idx" ON "notification"("createdAt");

-- CreateIndex
CREATE INDEX "saved_location_userId_idx" ON "saved_location"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_config_vehicleType_key" ON "pricing_config"("vehicleType");

-- CreateIndex
CREATE INDEX "surge_zone_isActive_idx" ON "surge_zone"("isActive");
CREATE INDEX "surge_zone_centerLat_centerLng_idx" ON "surge_zone"("centerLat", "centerLng");

-- CreateIndex
CREATE UNIQUE INDEX "promo_code_code_key" ON "promo_code"("code");
CREATE INDEX "promo_code_code_idx" ON "promo_code"("code");
CREATE INDEX "promo_code_isActive_idx" ON "promo_code"("isActive");

-- CreateIndex
CREATE INDEX "promo_code_usage_promoCodeId_idx" ON "promo_code_usage"("promoCodeId");
CREATE INDEX "promo_code_usage_userId_idx" ON "promo_code_usage"("userId");
CREATE INDEX "promo_code_usage_promoCodeId_userId_idx" ON "promo_code_usage"("promoCodeId", "userId");

-- AddForeignKey
ALTER TABLE "driver" ADD CONSTRAINT "driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_location" ADD CONSTRAINT "driver_location_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride" ADD CONSTRAINT "ride_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride" ADD CONSTRAINT "ride_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_payment_method" ADD CONSTRAINT "user_payment_method_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_earning" ADD CONSTRAINT "driver_earning_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating" ADD CONSTRAINT "rating_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating" ADD CONSTRAINT "rating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating" ADD CONSTRAINT "rating_rateeId_fkey" FOREIGN KEY ("rateeId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_location" ADD CONSTRAINT "saved_location_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_usage" ADD CONSTRAINT "promo_code_usage_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
