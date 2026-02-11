import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { VehicleType } from '../generated/prisma/enums.js';

interface CreateRideInput {
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: VehicleType;
  passengerNote?: string;
  pickupPhotoUrl?: string;
  routeQuoteId?: string;
}

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new ride from the booking payload.
   * If a routeQuoteId is provided, uses the pre-calculated fare from that quote.
   */
  async createRide(passengerId: string, input: CreateRideInput) {
    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      vehicleType,
      passengerNote,
      pickupPhotoUrl,
      routeQuoteId,
    } = input;

    // Default fare values
    let baseFare = 0;
    const distanceFare = 0;
    const timeFare = 0;
    let totalFare = 0;
    let distanceMeters: number | undefined;
    let durationSeconds: number | undefined;
    let polyline: string | undefined;
    let currency = 'MMK';

    // Use pre-calculated fare from RouteQuote if available
    if (routeQuoteId) {
      const quote = await this.prisma.routeQuote.findUnique({
        where: { id: routeQuoteId },
      });

      if (!quote) {
        throw new BadRequestException(`RouteQuote not found: ${routeQuoteId}`);
      }

      distanceMeters = quote.distanceMeters;
      durationSeconds = quote.durationSeconds;
      polyline = quote.encodedPolyline;
      currency = quote.currency;

      // Select fare based on vehicle type
      const isPlus = vehicleType === VehicleType.PLUS;
      totalFare = Number(
        isPlus ? quote.taxiPlusFareMmkt : quote.standardFareMmkt,
      );
      baseFare = totalFare; // Simplified: entire quoted fare as base

      // Link the quote to this ride
      await this.prisma.routeQuote.update({
        where: { id: routeQuoteId },
        data: { rideId: 'pending' }, // Will update with actual rideId below
      });
    }

    const ride = await this.prisma.ride.create({
      data: {
        passengerId,
        vehicleType,
        pickupAddress,
        pickupLat,
        pickupLng,
        dropoffAddress,
        dropoffLat,
        dropoffLng,
        distanceMeters,
        durationSeconds,
        polyline,
        baseFare,
        distanceFare,
        timeFare,
        totalFare,
        currency,
        passengerNote: passengerNote ?? null,
        pickupPhotoUrl: pickupPhotoUrl ?? null,
      },
    });

    // Update the quote with the actual ride ID
    if (routeQuoteId) {
      await this.prisma.routeQuote.update({
        where: { id: routeQuoteId },
        data: { rideId: ride.id },
      });
    }

    this.logger.log(`Ride created: ${ride.id} for passenger ${passengerId}`);

    return {
      id: ride.id,
      status: ride.status,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      totalFare: Number(ride.totalFare),
      currency: ride.currency,
      vehicleType: ride.vehicleType,
      createdAt: ride.createdAt,
    };
  }
}
