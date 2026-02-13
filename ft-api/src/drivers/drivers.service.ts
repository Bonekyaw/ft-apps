import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import type { DriverApprovalStatus, VehicleType, FuelType } from '../generated/prisma/enums.js';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Create a new user with DRIVER role and a corresponding Driver record. */
  async createDriver(name: string, email: string) {
    const trimmedEmail = email.trim().toLowerCase();

    // Check for existing user
    const existing = await this.prisma.user.findUnique({
      where: { email: trimmedEmail },
    });
    if (existing) {
      throw new BadRequestException(
        `A user with email "${trimmedEmail}" already exists.`,
      );
    }

    // Create user + driver in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: randomUUID(),
          name,
          email: trimmedEmail,
          emailVerified: true, // Admin-created drivers don't need email verification
          role: 'DRIVER',
        },
      });

      const driver = await tx.driver.create({
        data: {
          userId: user.id,
          approvalStatus: 'PENDING',
        },
      });

      return { user, driver };
    });

    this.logger.log(
      `Driver created: ${result.user.email} (${result.driver.id})`,
    );
    return {
      id: result.driver.id,
      userId: result.user.id,
      name: result.user.name,
      email: result.user.email,
      approvalStatus: result.driver.approvalStatus,
    };
  }

  /** List all drivers with their user info. */
  async listDrivers() {
    const drivers = await this.prisma.driver.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            banned: true,
            createdAt: true,
          },
        },
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return drivers.map((d) => ({
      id: d.id,
      userId: d.userId,
      name: d.user.name,
      email: d.user.email,
      image: d.user.image,
      banned: d.user.banned,
      approvalStatus: d.approvalStatus,
      status: d.status,
      petFriendly: d.petFriendly,
      isVip: d.isVip,
      licenseNumber: d.licenseNumber,
      licenseExpiry: d.licenseExpiry,
      nationalId: d.nationalId,
      licenseImageUrl: d.licenseImageUrl,
      nationalIdImageUrl: d.nationalIdImageUrl,
      totalRides: d.totalRides,
      averageRating: d.averageRating,
      vehicle: d.vehicle,
      createdAt: d.user.createdAt,
    }));
  }

  /** Get a single driver with full details. */
  async getDriver(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
            banned: true,
            createdAt: true,
          },
        },
        vehicle: true,
      },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    return {
      id: driver.id,
      userId: driver.userId,
      name: driver.user.name,
      email: driver.user.email,
      image: driver.user.image,
      phone: driver.user.phone,
      banned: driver.user.banned,
      approvalStatus: driver.approvalStatus,
      status: driver.status,
      petFriendly: driver.petFriendly,
      isVip: driver.isVip,
      licenseNumber: driver.licenseNumber,
      licenseExpiry: driver.licenseExpiry,
      nationalId: driver.nationalId,
      licenseImageUrl: driver.licenseImageUrl,
      nationalIdImageUrl: driver.nationalIdImageUrl,
      totalRides: driver.totalRides,
      totalEarnings: driver.totalEarnings,
      averageRating: driver.averageRating,
      ratingCount: driver.ratingCount,
      vehicle: driver.vehicle,
      createdAt: driver.user.createdAt,
    };
  }

  /** Set driver approval status. */
  async setApprovalStatus(id: string, status: DriverApprovalStatus) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Driver not found');

    const updated = await this.prisma.driver.update({
      where: { id },
      data: { approvalStatus: status },
      include: { user: { select: { name: true, email: true } } },
    });

    this.logger.log(
      `Driver ${updated.user.email} approval status -> ${status}`,
    );
    return {
      id: updated.id,
      approvalStatus: updated.approvalStatus,
      name: updated.user.name,
      email: updated.user.email,
    };
  }

  /** Update driver details. */
  async updateDriver(
    id: string,
    data: {
      licenseNumber?: string;
      licenseExpiry?: string;
      nationalId?: string;
      petFriendly?: boolean;
      isVip?: boolean;
    },
  ) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Driver not found');

    const updated = await this.prisma.driver.update({
      where: { id },
      data: {
        ...(data.licenseNumber !== undefined && {
          licenseNumber: data.licenseNumber,
        }),
        ...(data.licenseExpiry !== undefined && {
          licenseExpiry: new Date(data.licenseExpiry),
        }),
        ...(data.nationalId !== undefined && {
          nationalId: data.nationalId,
        }),
        ...(data.petFriendly !== undefined && {
          petFriendly: data.petFriendly,
        }),
        ...(data.isVip !== undefined && {
          isVip: data.isVip,
        }),
      },
      include: { user: { select: { name: true, email: true } } },
    });

    return {
      id: updated.id,
      name: updated.user.name,
      email: updated.user.email,
      licenseNumber: updated.licenseNumber,
      licenseExpiry: updated.licenseExpiry,
      nationalId: updated.nationalId,
      petFriendly: updated.petFriendly,
      isVip: updated.isVip,
    };
  }

  /** Update a document image URL on a driver. */
  async updateDriverDocument(id: string, field: string, url: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Driver not found');

    const updated = await this.prisma.driver.update({
      where: { id },
      data: { [field]: url },
    });

    return {
      id: updated.id,
      [field]: url,
    };
  }

  /** Create or update the vehicle record for a driver. */
  async upsertVehicle(
    driverId: string,
    data: {
      type: VehicleType;
      fuelType?: FuelType | null;
      make: string;
      model: string;
      year: number;
      color: string;
      plateNumber: string;
      capacity?: number;
    },
  ) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

    const vehicle = await this.prisma.vehicle.upsert({
      where: { driverId },
      create: {
        driverId,
        type: data.type,
        fuelType: data.fuelType ?? null,
        make: data.make,
        model: data.model,
        year: data.year,
        color: data.color,
        plateNumber: data.plateNumber,
        capacity: data.capacity ?? 4,
      },
      update: {
        type: data.type,
        fuelType: data.fuelType ?? null,
        make: data.make,
        model: data.model,
        year: data.year,
        color: data.color,
        plateNumber: data.plateNumber,
        capacity: data.capacity ?? 4,
      },
    });

    // Sync denormalized fields on the Driver record for single-table matching
    await this.prisma.driver.update({
      where: { id: driverId },
      data: {
        vehicleType: data.type,
        fuelType: data.fuelType ?? null,
        maxPassengers: data.capacity ?? 4,
      },
    });

    this.logger.log(`Vehicle upserted for driver ${driverId}: ${vehicle.id}`);
    return vehicle;
  }

  /** Delete a driver and their user account. */
  async deleteDriver(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    // Delete user (cascades to driver)
    await this.prisma.user.delete({ where: { id: driver.userId } });

    this.logger.log(`Driver deleted: ${driver.user.email}`);
    return { success: true };
  }

  /**
   * Validate whether an email is eligible for driver login.
   * Returns `{ eligible: true }` or throws with a descriptive message.
   */
  async validateLoginEmail(email: string): Promise<{ eligible: true }> {
    const trimmedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: trimmedEmail },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new BadRequestException(
        'No driver account found for this email. Contact your administrator.',
      );
    }

    const role = typeof user.role === 'string' ? user.role.toUpperCase() : '';

    if (role !== 'DRIVER') {
      throw new BadRequestException(
        'This app is for drivers only. Please use the correct app for your account.',
      );
    }

    const driver = await this.prisma.driver.findUnique({
      where: { userId: user.id },
      select: { approvalStatus: true },
    });

    if (!driver) {
      throw new BadRequestException(
        'Your driver profile is not set up. Contact your administrator.',
      );
    }

    if (driver.approvalStatus === 'PENDING') {
      throw new BadRequestException(
        'Your account is pending verification. Please wait for admin approval.',
      );
    }

    if (driver.approvalStatus === 'REJECTED') {
      throw new BadRequestException(
        'Your account has been rejected. Please contact support.',
      );
    }

    if (driver.approvalStatus === 'SUSPENDED') {
      throw new BadRequestException(
        'Your driver account has been suspended. Please contact support.',
      );
    }

    if (driver.approvalStatus !== 'APPROVED') {
      throw new BadRequestException(
        'Your driver profile is not active. Contact your administrator.',
      );
    }

    return { eligible: true };
  }

  /** Revoke all sessions for a driver. */
  async revokeSessions(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const deleted = await this.prisma.session.deleteMany({
      where: { userId: driver.userId },
    });

    this.logger.log(
      `Revoked ${deleted.count} sessions for driver: ${driver.user.email}`,
    );
    return { success: true, revokedCount: deleted.count };
  }
}
