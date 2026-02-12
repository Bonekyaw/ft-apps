import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import type { DriverStatus } from '../generated/prisma/enums.js';

/** Allowed status transitions from the driver app. */
const DRIVER_SETTABLE_STATUSES: DriverStatus[] = ['ONLINE', 'OFFLINE'];

@Injectable()
export class DriverStatusService implements OnModuleInit {
  private readonly logger = new Logger(DriverStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────────
  // PostGIS setup — runs once on application start (idempotent)
  // ──────────────────────────────────────────────────────────

  async onModuleInit() {
    try {
      // 1. Enable PostGIS extension
      await this.prisma.$queryRawUnsafe(
        `CREATE EXTENSION IF NOT EXISTS postgis;`,
      );

      // 2. Add geography column if it doesn't exist
      await this.prisma.$queryRawUnsafe(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'driver_location' AND column_name = 'location'
          ) THEN
            ALTER TABLE driver_location
              ADD COLUMN location geography(Point, 4326);
          END IF;
        END $$;
      `);

      // 3. Create GIST index for fast spatial queries
      await this.prisma.$queryRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_driver_location_gist
        ON driver_location USING GIST (location);
      `);

      this.logger.log('PostGIS extension and geography column ready.');
    } catch (error) {
      this.logger.error('Failed to initialize PostGIS resources', error);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Resolve the Driver record from a userId
  // ──────────────────────────────────────────────────────────

  private async getDriverByUserId(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      select: { id: true, status: true, approvalStatus: true },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found for this user.');
    }
    if (driver.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException(
        'Your driver account must be approved before going online.',
      );
    }
    return driver;
  }

  // ──────────────────────────────────────────────────────────
  // Update driver availability status
  // ──────────────────────────────────────────────────────────

  async updateStatus(userId: string, status: DriverStatus) {
    if (!DRIVER_SETTABLE_STATUSES.includes(status)) {
      throw new ForbiddenException(
        `Drivers can only set status to ${DRIVER_SETTABLE_STATUSES.join(' or ')}.`,
      );
    }

    const driver = await this.getDriverByUserId(userId);

    const updated = await this.prisma.driver.update({
      where: { id: driver.id },
      data: { status },
      select: { id: true, status: true },
    });

    this.logger.log(`Driver ${driver.id} status → ${status}`);
    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // Webhook-driven status update (graceful — never throws)
  // ──────────────────────────────────────────────────────────

  /**
   * Set a driver's status by their userId.
   * Designed for Ably Presence webhooks: if no driver is found or
   * the driver is not approved, the call is silently skipped (logged
   * as a warning) instead of throwing an exception.
   */
  async setStatusByUserId(userId: string, status: DriverStatus): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      select: { id: true, approvalStatus: true, status: true },
    });

    if (!driver) {
      this.logger.warn(
        `Presence webhook: no driver found for userId ${userId} — skipping.`,
      );
      return;
    }

    if (driver.approvalStatus !== 'APPROVED') {
      this.logger.warn(
        `Presence webhook: driver ${driver.id} is not APPROVED (${driver.approvalStatus}) — skipping.`,
      );
      return;
    }

    // Skip no-op updates
    if (driver.status === status) return;

    await this.prisma.driver.update({
      where: { id: driver.id },
      data: { status },
    });

    this.logger.log(`Presence webhook: driver ${driver.id} status → ${status}`);
  }

  // ──────────────────────────────────────────────────────────
  // Update driver location (Prisma columns + PostGIS geography)
  // ──────────────────────────────────────────────────────────

  async updateLocation(
    userId: string,
    data: {
      latitude: number;
      longitude: number;
      heading?: number;
      speed?: number;
      accuracy?: number;
    },
  ) {
    const driver = await this.getDriverByUserId(userId);

    const { latitude, longitude, heading, speed, accuracy } = data;

    // 1. Upsert the Prisma-managed columns
    await this.prisma.driverLocation.upsert({
      where: { driverId: driver.id },
      create: {
        driverId: driver.id,
        latitude,
        longitude,
        heading: heading ?? null,
        speed: speed ?? null,
        accuracy: accuracy ?? null,
      },
      update: {
        latitude,
        longitude,
        heading: heading ?? null,
        speed: speed ?? null,
        accuracy: accuracy ?? null,
      },
    });

    // 2. Update the PostGIS geography column (ST_MakePoint takes lng, lat)
    await this.prisma.$queryRawUnsafe(
      `UPDATE driver_location
       SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       WHERE "driverId" = $3`,
      longitude,
      latitude,
      driver.id,
    );

    this.logger.debug(
      `Driver ${driver.id} location → (${latitude}, ${longitude})`,
    );

    return {
      driverId: driver.id,
      latitude,
      longitude,
      heading: heading ?? null,
      speed: speed ?? null,
    };
  }

  // ──────────────────────────────────────────────────────────
  // Get current driver status + location
  // ──────────────────────────────────────────────────────────

  async getStatus(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        approvalStatus: true,
        currentLocation: {
          select: {
            latitude: true,
            longitude: true,
            heading: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found.');
    }
    return {
      driverId: driver.id,
      status: driver.status,
      approvalStatus: driver.approvalStatus,
      location: driver.currentLocation
        ? {
            latitude: Number(driver.currentLocation.latitude),
            longitude: Number(driver.currentLocation.longitude),
            heading: driver.currentLocation.heading
              ? Number(driver.currentLocation.heading)
              : null,
            updatedAt: driver.currentLocation.updatedAt,
          }
        : null,
    };
  }
}
