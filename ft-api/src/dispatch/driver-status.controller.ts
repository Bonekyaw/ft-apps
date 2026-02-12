import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { DriverStatusService } from './driver-status.service.js';
import { MatchingService } from './matching.service.js';
import type { DriverStatus } from '../generated/prisma/enums.js';

/** Ensure the caller has the DRIVER role. */
function assertDriver(session: UserSession | null): string {
  if (!session?.user) {
    throw new ForbiddenException('Authentication required.');
  }
  const role =
    typeof session.user.role === 'string'
      ? session.user.role.toUpperCase()
      : '';
  if (role !== 'DRIVER') {
    throw new ForbiddenException('Only drivers can access this endpoint.');
  }
  return session.user.id;
}

// ── DTOs ──

interface UpdateStatusDto {
  status: DriverStatus;
}

interface UpdateLocationDto {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
}

@Controller('dispatch')
export class DriverStatusController {
  constructor(
    private readonly statusService: DriverStatusService,
    private readonly matchingService: MatchingService,
  ) {}

  // ──────────────────────────────────────────────────
  // GET /dispatch/status — Current driver status
  // ──────────────────────────────────────────────────

  @Get('status')
  async getStatus(@Session() session: UserSession | null) {
    const userId = assertDriver(session);
    return this.statusService.getStatus(userId);
  }

  // ──────────────────────────────────────────────────
  // PATCH /dispatch/status — Go ONLINE / OFFLINE
  // ──────────────────────────────────────────────────

  @Patch('status')
  async updateStatus(
    @Session() session: UserSession | null,
    @Body() dto: UpdateStatusDto,
  ) {
    const userId = assertDriver(session);
    return this.statusService.updateStatus(userId, dto.status);
  }

  // ──────────────────────────────────────────────────
  // POST /dispatch/location — Stream driver location
  // ──────────────────────────────────────────────────

  @Post('location')
  async updateLocation(
    @Session() session: UserSession | null,
    @Body() dto: UpdateLocationDto,
  ) {
    const userId = assertDriver(session);
    return this.statusService.updateLocation(userId, dto);
  }

  // ──────────────────────────────────────────────────
  // GET /dispatch/nearby — Find nearby online drivers
  // (Used internally or for admin/testing purposes)
  // ──────────────────────────────────────────────────

  @Get('nearby')
  async findNearby(
    @Query('lat') latStr: string,
    @Query('lng') lngStr: string,
    @Query('radius') radiusStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ForbiddenException(
        'lat and lng query parameters are required.',
      );
    }

    const radius = radiusStr ? parseInt(radiusStr, 10) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;

    const drivers = await this.matchingService.findNearbyDrivers(
      lat,
      lng,
      radius,
      limit,
    );

    return { count: drivers.length, drivers };
  }
}
