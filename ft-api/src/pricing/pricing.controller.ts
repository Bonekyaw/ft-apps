import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { RidePricingService } from './ride-pricing.service.js';
import { PrismaService } from '../prisma.service.js';

const ADMIN_ROLES = ['ADMIN', 'MANAGER', 'OPERATION', 'SUPERADMIN'];

function isAdmin(role: unknown): boolean {
  return (
    typeof role === 'string' &&
    ADMIN_ROLES.includes(role.toUpperCase())
  );
}

/** Require admin role for pricing endpoints. */
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

  @Get('defaults')
  async getDefaults(@Session() session: UserSession | null) {
    assertAdmin(session);
    const row = await this.prisma.pricingDefaults.findFirst();
    if (!row) {
      return {
        baseFareMinMmkt: 1500,
        baseFareMaxMmkt: 2000,
        initialKmForBase: 2,
        perKmRateDefaultMmkt: 1000,
        taxiPlusMultiplier: 1.2,
        currency: 'MMK',
      };
    }
    return {
      id: row.id,
      baseFareMinMmkt: Number(row.baseFareMinMmkt),
      baseFareMaxMmkt: Number(row.baseFareMaxMmkt),
      initialKmForBase: Number(row.initialKmForBase),
      perKmRateDefaultMmkt: Number(row.perKmRateDefaultMmkt),
      taxiPlusMultiplier: Number(row.taxiPlusMultiplier),
      currency: row.currency,
      updatedAt: row.updatedAt,
    };
  }

  @Put('defaults')
  async putDefaults(
    @Session() session: UserSession | null,
    @Body()
    body: {
      baseFareMinMmkt?: number;
      baseFareMaxMmkt?: number;
      initialKmForBase?: number;
      perKmRateDefaultMmkt?: number;
      taxiPlusMultiplier?: number;
      currency?: string;
    },
  ) {
    assertAdmin(session);
    const existing = await this.prisma.pricingDefaults.findFirst();
    const data = {
      baseFareMinMmkt: body.baseFareMinMmkt ?? existing?.baseFareMinMmkt ?? 1500,
      baseFareMaxMmkt: body.baseFareMaxMmkt ?? existing?.baseFareMaxMmkt ?? 2000,
      initialKmForBase: body.initialKmForBase ?? existing?.initialKmForBase ?? 2,
      perKmRateDefaultMmkt:
        body.perKmRateDefaultMmkt ?? existing?.perKmRateDefaultMmkt ?? 1000,
      taxiPlusMultiplier:
        body.taxiPlusMultiplier ?? existing?.taxiPlusMultiplier ?? 1.2,
      currency: body.currency ?? existing?.currency ?? 'MMK',
    };

    if (existing) {
      await this.prisma.pricingDefaults.update({
        where: { id: existing.id },
        data,
      });
      return { ...data, id: existing.id };
    }

    const created = await this.prisma.pricingDefaults.create({ data });
    return {
      id: created.id,
      ...data,
      updatedAt: created.updatedAt,
    };
  }

  @Get('rules')
  async getRules(@Session() session: UserSession | null) {
    assertAdmin(session);
    const rules = await this.prisma.pricingRule.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return rules.map((r) => ({
      id: r.id,
      name: r.name,
      active: r.active,
      priority: r.priority,
      ruleType: r.ruleType,
      minDistanceKm: r.minDistanceKm != null ? Number(r.minDistanceKm) : null,
      maxDistanceKm: r.maxDistanceKm != null ? Number(r.maxDistanceKm) : null,
      perKmRateMmkt: r.perKmRateMmkt != null ? Number(r.perKmRateMmkt) : null,
      startHour: r.startHour,
      endHour: r.endHour,
      timeSurgeMultiplier:
        r.timeSurgeMultiplier != null ? Number(r.timeSurgeMultiplier) : null,
      dayOfWeek: r.dayOfWeek,
      isWeekend: r.isWeekend,
      isHoliday: r.isHoliday,
      holidayDate: r.holidayDate,
      specialDayMultiplier:
        r.specialDayMultiplier != null ? Number(r.specialDayMultiplier) : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  @Post('rules')
  async createRule(
    @Session() session: UserSession | null,
    @Body()
    body: {
      name: string;
      active?: boolean;
      priority?: number;
      ruleType: string;
      minDistanceKm?: number;
      maxDistanceKm?: number;
      perKmRateMmkt?: number;
      startHour?: number;
      endHour?: number;
      timeSurgeMultiplier?: number;
      dayOfWeek?: number;
      isWeekend?: boolean;
      isHoliday?: boolean;
      holidayDate?: string;
      specialDayMultiplier?: number;
    },
  ) {
    assertAdmin(session);
    const rule = await this.prisma.pricingRule.create({
      data: {
        name: body.name,
        active: body.active ?? true,
        priority: body.priority ?? 0,
        ruleType: body.ruleType as 'DISTANCE_BAND' | 'TIME_OF_DAY' | 'SPECIAL_DAY',
        minDistanceKm: body.minDistanceKm,
        maxDistanceKm: body.maxDistanceKm,
        perKmRateMmkt: body.perKmRateMmkt,
        startHour: body.startHour,
        endHour: body.endHour,
        timeSurgeMultiplier: body.timeSurgeMultiplier,
        dayOfWeek: body.dayOfWeek,
        isWeekend: body.isWeekend,
        isHoliday: body.isHoliday,
        holidayDate: body.holidayDate ? new Date(body.holidayDate) : null,
        specialDayMultiplier: body.specialDayMultiplier,
      },
    });
    return { id: rule.id, ...body };
  }

  @Put('rules/:id')
  async updateRule(
    @Session() session: UserSession | null,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      active: boolean;
      priority: number;
      ruleType: string;
      minDistanceKm: number;
      maxDistanceKm: number;
      perKmRateMmkt: number;
      startHour: number;
      endHour: number;
      timeSurgeMultiplier: number;
      dayOfWeek: number;
      isWeekend: boolean;
      isHoliday: boolean;
      holidayDate: string;
      specialDayMultiplier: number;
    }>,
  ) {
    assertAdmin(session);
    const update: Record<string, unknown> = { ...body };
    if (body.holidayDate != null) {
      update.holidayDate = new Date(body.holidayDate);
    }
    if (body.ruleType != null) {
      update.ruleType = body.ruleType;
    }
    await this.prisma.pricingRule.update({
      where: { id },
      data: update as never,
    });
    return { id, ...body };
  }

  @Delete('rules/:id')
  async deleteRule(
    @Session() session: UserSession | null,
    @Param('id') id: string,
  ) {
    assertAdmin(session);
    await this.prisma.pricingRule.delete({ where: { id } });
    return { deleted: id };
  }
}
