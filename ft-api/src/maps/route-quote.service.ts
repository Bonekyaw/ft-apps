import { Injectable } from '@nestjs/common';
import { MapsService } from './maps.service.js';
import { RidePricingService } from '../pricing/ride-pricing.service.js';
import { PrismaService } from '../prisma.service.js';

export interface RouteQuoteInput {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
}

export interface RouteQuoteResult {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  standardFareMmkt: number;
  taxiPlusFareMmkt: number;
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

    const fare = await this.pricing.calculateFare(
      route.distanceMeters,
      route.durationSeconds,
      new Date(),
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
        standardFareMmkt: fare.standardMmkt,
        taxiPlusFareMmkt: fare.taxiPlusMmkt,
        currency: fare.currency,
      },
    });

    return {
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      encodedPolyline: route.encodedPolyline,
      standardFareMmkt: fare.standardMmkt,
      taxiPlusFareMmkt: fare.taxiPlusMmkt,
      currency: fare.currency,
      routeQuoteId: quote.id,
    };
  }
}
