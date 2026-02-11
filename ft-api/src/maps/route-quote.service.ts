import { Injectable } from '@nestjs/common';
import { MapsService } from './maps.service.js';
import { RidePricingService } from '../pricing/ride-pricing.service.js';
import { PrismaService } from '../prisma.service.js';

export interface RouteQuoteInput {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType?: string;
}

export interface RouteQuoteResult {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  encodedPolyline: string;
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
    );

    // Calculate Standard fare
    const standardFare = await this.pricing.calculateFare(
      route.distanceKm,
      route.durationMinutes,
      'STANDARD',
    );

    // Calculate Plus fare
    const plusFare = await this.pricing.calculateFare(
      route.distanceKm,
      route.durationMinutes,
      'PLUS',
    );

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
      standardFareMmkt: standardFare.totalFare,
      plusFareMmkt: plusFare.totalFare,
      currency: standardFare.currency,
      routeQuoteId: quote.id,
    };
  }
}
