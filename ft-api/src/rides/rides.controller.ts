import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ImageService } from '../content/image.service.js';
import { RidesService } from './rides.service.js';
import { VehicleType } from '../generated/prisma/enums.js';

interface CreateRideBody {
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType?: string;
  passengerNote?: string;
  pickupPhotoUrl?: string;
  routeQuoteId?: string;
}

@Controller('rides')
export class RidesController {
  private readonly logger = new Logger(RidesController.name);

  constructor(
    private readonly ridesService: RidesService,
    private readonly imageService: ImageService,
  ) {}

  /**
   * POST /rides/upload-photo
   * Upload a pickup location photo. Optimized to 800x600 WebP and stored on Vercel Blob.
   */
  @Post('upload-photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadPickupPhoto(
    @Session() session: UserSession,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.logger.log(`Pickup photo upload by user ${session.user.id}`);
    const url = await this.imageService.uploadOptimized(file, {
      purpose: 'pickup',
    });
    return { url };
  }

  /**
   * POST /rides
   * Create a new ride from the full booking payload.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRide(
    @Session() session: UserSession,
    @Body() body: CreateRideBody,
  ) {
    this.logger.log(`Create ride request from user ${session.user.id}`);

    const vehicleType =
      (body.vehicleType as VehicleType) || VehicleType.ECONOMY;

    return this.ridesService.createRide(session.user.id, {
      pickupAddress: body.pickupAddress,
      pickupLat: Number(body.pickupLat),
      pickupLng: Number(body.pickupLng),
      dropoffAddress: body.dropoffAddress,
      dropoffLat: Number(body.dropoffLat),
      dropoffLng: Number(body.dropoffLng),
      vehicleType,
      passengerNote: body.passengerNote,
      pickupPhotoUrl: body.pickupPhotoUrl,
      routeQuoteId: body.routeQuoteId,
    });
  }

  /**
   * GET /rides/:id/status
   * Lightweight polling endpoint for the rider to check ride status.
   * Returns the current status + driver info if accepted.
   */
  @Get(':id/status')
  async getRideStatus(
    @Session() session: UserSession,
    @Param('id') rideId: string,
  ) {
    return this.ridesService.getRideStatus(rideId, session.user.id);
  }

  /**
   * POST /rides/:id/accept
   * Driver accepts a pending ride. Race-condition safe.
   */
  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  async acceptRide(
    @Session() session: UserSession,
    @Param('id') rideId: string,
  ) {
    this.logger.log(`Driver user ${session.user.id} accepting ride ${rideId}`);
    return this.ridesService.acceptRide(rideId, session.user.id);
  }

  /**
   * POST /rides/:id/skip
   * Driver declines a ride request. Ride stays PENDING for others.
   */
  @Post(':id/skip')
  @HttpCode(HttpStatus.OK)
  async skipRide(@Session() session: UserSession, @Param('id') rideId: string) {
    this.logger.log(`Driver user ${session.user.id} skipping ride ${rideId}`);
    return this.ridesService.skipRide(rideId, session.user.id);
  }

  /**
   * POST /rides/:id/cancel
   * Cancel an accepted ride. Can be called by the driver or the passenger.
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelRide(
    @Session() session: UserSession,
    @Param('id') rideId: string,
    @Body() body: { reason?: string },
  ) {
    this.logger.log(`User ${session.user.id} cancelling ride ${rideId}`);
    return this.ridesService.cancelRide(rideId, session.user.id, body.reason);
  }
}
