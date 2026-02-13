import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { I18n, I18nContext } from 'nestjs-i18n';
import {
  Session,
  type UserSession,
  AllowAnonymous,
  OptionalAuth,
} from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../prisma.service.js';

const ADMIN_ROLES = ['ADMIN', 'MANAGER', 'OPERATION', 'SUPERADMIN'];

@Controller('user')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public endpoint – validates whether an email is eligible for rider login.
   * Called by the ft-user app BEFORE sign-in / forgot-password to give clear
   * error messages and avoid sending OTPs to ineligible accounts.
   */
  @Post('validate-login')
  @AllowAnonymous()
  async validateLogin(@Body() body: { email: string }) {
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { role: true },
    });

    if (!user) {
      // Allow — new users can sign up; existing flow handles "invalid credentials"
      return { eligible: true };
    }

    const role = typeof user.role === 'string' ? user.role.toUpperCase() : '';

    if (role === 'DRIVER') {
      throw new BadRequestException(
        'This account is registered as a driver. Please use the Family Driver app.',
      );
    }

    if (ADMIN_ROLES.includes(role)) {
      throw new BadRequestException(
        'This account is for admin access only. Please use the admin dashboard.',
      );
    }

    return { eligible: true };
  }

  @Get('me')
  getProfile(@Session() session: UserSession) {
    return { user: session.user };
  }

  @Get('public')
  @AllowAnonymous()
  getPublic(@I18n() i18n: I18nContext) {
    const message = i18n.t('common.publicRoute');
    return { message };
  }

  @Get('optional')
  @OptionalAuth()
  getOptional(@Session() session: UserSession) {
    return { authenticated: !!session };
  }

  // ===================================================
  // SAVED PLACES
  // ===================================================

  /** GET /user/saved-places */
  @Get('saved-places')
  async getSavedPlaces(@Session() session: UserSession) {
    const places = await this.prisma.savedLocation.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return {
      places: places.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        icon: p.icon,
      })),
    };
  }

  /** POST /user/saved-places */
  @Post('saved-places')
  async createSavedPlace(
    @Session() session: UserSession,
    @Body()
    body: {
      name: string;
      address: string;
      latitude: number;
      longitude: number;
      icon?: string;
    },
  ) {
    const place = await this.prisma.savedLocation.create({
      data: {
        userId: session.user.id,
        name: body.name,
        address: body.address,
        latitude: body.latitude,
        longitude: body.longitude,
        icon: body.icon ?? null,
      },
    });
    return {
      id: place.id,
      name: place.name,
      address: place.address,
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
      icon: place.icon,
    };
  }

  /** PUT /user/saved-places/:id */
  @Put('saved-places/:id')
  async updateSavedPlace(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      icon?: string;
    },
  ) {
    const place = await this.prisma.savedLocation.updateMany({
      where: { id, userId: session.user.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.latitude !== undefined && { latitude: body.latitude }),
        ...(body.longitude !== undefined && { longitude: body.longitude }),
        ...(body.icon !== undefined && { icon: body.icon }),
      },
    });
    return { updated: place.count };
  }

  /** DELETE /user/saved-places/:id */
  @Delete('saved-places/:id')
  async deleteSavedPlace(
    @Session() session: UserSession,
    @Param('id') id: string,
  ) {
    const result = await this.prisma.savedLocation.deleteMany({
      where: { id, userId: session.user.id },
    });
    return { deleted: result.count };
  }

  // ===================================================
  // RIDE HISTORY
  // ===================================================

  /** GET /user/history — recent completed/cancelled rides. */
  @Get('history')
  async getRideHistory(
    @Session() session: UserSession,
    @Query('limit') limitStr?: string,
  ) {
    const limit = Math.min(Number(limitStr) || 10, 50);

    const rides = await this.prisma.ride.findMany({
      where: {
        passengerId: session.user.id,
        status: { in: ['COMPLETED', 'CANCELLED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        dropoffAddress: true,
        dropoffMainText: true,
        dropoffLat: true,
        dropoffLng: true,
        totalFare: true,
        currency: true,
        completedAt: true,
        createdAt: true,
      },
    });

    return {
      rides: rides.map((r) => ({
        id: r.id,
        status: r.status,
        pickupAddress: r.pickupAddress,
        pickupLat: Number(r.pickupLat),
        pickupLng: Number(r.pickupLng),
        dropoffAddress: r.dropoffAddress,
        dropoffMainText: r.dropoffMainText,
        dropoffLat: Number(r.dropoffLat),
        dropoffLng: Number(r.dropoffLng),
        totalFare: Number(r.totalFare),
        currency: r.currency,
        completedAt: r.completedAt,
        createdAt: r.createdAt,
      })),
    };
  }
}
