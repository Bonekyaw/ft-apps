import {
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

@Controller('user')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

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
