import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
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
  private readonly logger = new Logger(RouteQuoteService.name);

  constructor(
    private readonly maps: MapsService,
    private readonly pricing: RidePricingService,
    private readonly prisma: PrismaService,
  ) {}

  async getQuote(input: RouteQuoteInput): Promise<RouteQuoteResult> {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng } = input;

    // 1. Compute route via Google Routes API
    let route: Awaited<ReturnType<MapsService['computeRoute']>>;
    try {
      route = await this.maps.computeRoute(
        { lat: pickupLat, lng: pickupLng },
        { lat: dropoffLat, lng: dropoffLng },
        input.waypoints,
      );
    } catch (err) {
      this.logger.error('Google Routes API error', err);
      throw new InternalServerErrorException(
        'Failed to compute route. Please try again.',
      );
    }

    // 2. Calculate fares (synchronous, from in-memory cache)
    const standardFare = this.pricing.calculateFare({
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      vehicleType: 'STANDARD',
      originTownship: input.originTownship,
      destinationTownship: input.destinationTownship,
    });

    const plusFare = this.pricing.calculateFare({
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      vehicleType: 'PLUS',
      originTownship: input.originTownship,
      destinationTownship: input.destinationTownship,
    });

    // 3. Persist the quote — retry once on Neon WebSocket / transient DB errors
    let quoteId = '';
    try {
      const quote = await this.createQuoteWithRetry({
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
      });
      quoteId = quote.id;
    } catch (err) {
      this.logger.error('Failed to persist route quote after retry', err);
      throw new InternalServerErrorException(
        'Route calculated but failed to save. Please try again.',
      );
    }

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
      routeQuoteId: quoteId,
    };
  }

  /**
   * Attempt to create a route quote in the DB, retrying once on transient errors
   * (e.g. Neon WebSocket drops that surface as ErrorEvent).
   */
  private async createQuoteWithRetry(data: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    distanceMeters: number;
    durationSeconds: number;
    encodedPolyline: string;
    standardFareMmkt: number;
    taxiPlusFareMmkt: number;
    currency: string;
  }) {
    try {
      return await this.prisma.routeQuote.create({ data });
    } catch (firstErr) {
      this.logger.warn(
        'Route quote DB insert failed, retrying once…',
        firstErr instanceof Error ? firstErr.message : String(firstErr),
      );
      // Brief pause before retry to let the connection pool recover
      await new Promise((r) => setTimeout(r, 500));
      return await this.prisma.routeQuote.create({ data });
    }
  }
}
