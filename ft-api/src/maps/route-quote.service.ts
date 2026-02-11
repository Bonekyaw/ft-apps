import { Injectable } from '@nestjs/common';
import { MapsService, type SpeedReadingInterval } from './maps.service.js';
import { RidePricingService } from '../pricing/ride-pricing.service.js';
import { PrismaService } from '../prisma.service.js';

export interface RouteQuoteInput {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  /** Intermediate stops between pickup and final dropoff. */
  waypoints?: { lat: number; lng: number }[];
  vehicleType?: string;
  /** Township name of the pickup location. */
  originTownship?: string;
  /** Township name of the dropoff location. */
  destinationTownship?: string;
}

export interface RouteQuoteResult {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  encodedPolyline: string;
  speedReadingIntervals: SpeedReadingInterval[];
  standardFareMmkt: number;
  plusFareMmkt: number;
  currency: string;
  routeQuoteId: string;
}

@Injectable()
export class RouteQuoteService {
  constructor(
    private readonly maps: MapsService,
    private readonly pricing: RidePricingService,
    private readonly prisma: PrismaService,
  ) {}

  async getQuote(input: RouteQuoteInput): Promise<RouteQuoteResult> {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng } = input;

    const route = await this.maps.computeRoute(
      { lat: pickupLat, lng: pickupLng },
      { lat: dropoffLat, lng: dropoffLng },
      input.waypoints,
    );

    // Calculate Standard fare (with optional township surcharge)
    const standardFare = this.pricing.calculateFare({
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      vehicleType: 'STANDARD',
      originTownship: input.originTownship,
      destinationTownship: input.destinationTownship,
    });

    // Calculate Plus fare (with optional township surcharge)
    const plusFare = this.pricing.calculateFare({
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      vehicleType: 'PLUS',
      originTownship: input.originTownship,
      destinationTownship: input.destinationTownship,
    });

    const quote = await this.prisma.routeQuote.create({
      data: {
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        encodedPolyline: route.encodedPolyline,
        standardFareMmkt: standardFare.totalFare,
        taxiPlusFareMmkt: plusFare.totalFare,
        currency: standardFare.currency,
      },
    });

    return {
      distanceMeters: route.distanceMeters,
      distanceKm: route.distanceKm,
      durationSeconds: route.durationSeconds,
      durationMinutes: route.durationMinutes,
      encodedPolyline: route.encodedPolyline,
      speedReadingIntervals: route.speedReadingIntervals,
      standardFareMmkt: standardFare.totalFare,
      plusFareMmkt: plusFare.totalFare,
      currency: standardFare.currency,
      routeQuoteId: quote.id,
    };
  }
}
