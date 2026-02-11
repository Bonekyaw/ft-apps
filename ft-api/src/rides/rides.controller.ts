import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
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
}
