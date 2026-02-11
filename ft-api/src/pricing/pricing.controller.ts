import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { RidePricingService } from './ride-pricing.service.js';
import { PrismaService } from '../prisma.service.js';
import { VehicleType } from '../generated/prisma/enums.js';

const ADMIN_ROLES = ['ADMIN', 'MANAGER', 'OPERATION', 'SUPERADMIN'];

function isAdmin(role: unknown): boolean {
  return typeof role === 'string' && ADMIN_ROLES.includes(role.toUpperCase());
}

function assertAdmin(session: UserSession | null): void {
  if (!session?.user) {
    throw new UnauthorizedException('Unauthorized');
  }
  if (!isAdmin(session.user.role)) {
    throw new ForbiddenException('Admin access required');
  }
}

@Controller('pricing')
export class PricingController {
  constructor(
    private readonly pricing: RidePricingService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('config')
  async getConfig(@Session() session: UserSession | null) {
    assertAdmin(session);
    const rows = await this.prisma.pricingConfig.findMany({
      orderBy: { vehicleType: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      vehicleType: r.vehicleType,
      baseFare: Number(r.baseFare),
      perKmRate: Number(r.perKmRate),
      timeRate: Number(r.timeRate),
      bookingFee: Number(r.bookingFee),
      surgeMultiplier: Number(r.surgeMultiplier),
      currency: r.currency,
      timeRules: r.timeRules ?? [],
      distanceBands: r.distanceBands ?? [],
      specialDayRates: r.specialDayRates ?? [],
      updatedAt: r.updatedAt,
    }));
  }

  @Put('config')
  async putConfig(
    @Session() session: UserSession | null,
    @Body()
    body: {
      vehicleType?: VehicleType;
      baseFare?: number;
      perKmRate?: number;
      timeRate?: number;
      bookingFee?: number;
      surgeMultiplier?: number;
      currency?: string;
      timeRules?: unknown;
      distanceBands?: unknown;
      specialDayRates?: unknown;
    },
  ) {
    assertAdmin(session);
    const { vehicleType = 'STANDARD', ...rest } = body;

    const data = {
      baseFare: rest.baseFare ?? 1500,
      perKmRate: rest.perKmRate ?? 1000,
      timeRate: rest.timeRate ?? 0,
      bookingFee: rest.bookingFee ?? 0,
      surgeMultiplier: rest.surgeMultiplier ?? 1.0,
      currency: rest.currency ?? 'MMK',
      timeRules: rest.timeRules ?? [],
      distanceBands: rest.distanceBands ?? [],
      specialDayRates: rest.specialDayRates ?? [],
    };

    const config = await this.prisma.pricingConfig.upsert({
      where: { vehicleType: vehicleType },
      update: {
        baseFare: rest.baseFare,
        perKmRate: rest.perKmRate,
        timeRate: rest.timeRate,
        bookingFee: rest.bookingFee,
        surgeMultiplier: rest.surgeMultiplier,
        currency: rest.currency,
        timeRules: rest.timeRules ?? undefined,
        distanceBands: rest.distanceBands ?? undefined,
        specialDayRates: rest.specialDayRates ?? undefined,
      },
      create: {
        vehicleType,
        ...data,
      },
    });

    return {
      id: config.id,
      vehicleType: config.vehicleType,
      baseFare: Number(config.baseFare),
      perKmRate: Number(config.perKmRate),
      timeRate: Number(config.timeRate),
      bookingFee: Number(config.bookingFee),
      surgeMultiplier: Number(config.surgeMultiplier),
      currency: config.currency,
      timeRules: config.timeRules ?? [],
      distanceBands: config.distanceBands ?? [],
      specialDayRates: config.specialDayRates ?? [],
      updatedAt: config.updatedAt,
    };
  }
}
