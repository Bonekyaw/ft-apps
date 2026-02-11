import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { VehicleType } from '../generated/prisma/enums.js';

// ── JSON shapes stored in PricingConfig ──

interface DistanceBand {
  minKm: number;
  maxKm: number | null; // null = no upper limit
  perKmRate: number;
}

interface SpecialDayRate {
  name: string;
  perKmRate: number;
  isWeekend: boolean;
  holidayDates: string[]; // "YYYY-MM-DD"
}

interface TimeRule {
  start: number;
  end: number;
  multiplier: number;
}

// ── Public result type ──

export interface FareResult {
  totalFare: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  bookingFee: number;
  surgeMultiplier: number;
  currency: string;
  isSpecialDay: boolean;
  specialDayName: string | null;
  breakdown: {
    distanceKm: number;
    durationMinutes: number;
    effectivePerKmRate: number;
    timeRate: number;
    bandSegments: {
      minKm: number;
      maxKm: number;
      km: number;
      perKmRate: number;
      fare: number;
    }[];
  };
}

@Injectable()
export class RidePricingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Config loader ──

  private async getConfig(vehicleType: VehicleType = 'STANDARD') {
    let config = await this.prisma.pricingConfig.findFirst({
      where: { vehicleType },
    });

    if (!config && vehicleType !== 'STANDARD') {
      config = await this.prisma.pricingConfig.findFirst({
        where: { vehicleType: 'STANDARD' },
      });
    }

    if (!config) {
      return {
        baseFare: 1500,
        perKmRate: 1000,
        timeRate: 0,
        bookingFee: 0,
        surgeMultiplier: 1.0,
        currency: 'MMK',
        vehicleType: 'STANDARD' as const,
        timeRules: [] as TimeRule[],
        distanceBands: [] as DistanceBand[],
        specialDayRates: [] as SpecialDayRate[],
      };
    }

    return {
      baseFare: Number(config.baseFare),
      perKmRate: Number(config.perKmRate),
      timeRate: Number(config.timeRate),
      bookingFee: Number(config.bookingFee),
      surgeMultiplier: Number(config.surgeMultiplier),
      currency: config.currency,
      vehicleType: config.vehicleType,
      timeRules: (Array.isArray(config.timeRules)
        ? config.timeRules
        : []) as unknown as TimeRule[],
      distanceBands: (Array.isArray(config.distanceBands)
        ? config.distanceBands
        : []) as unknown as DistanceBand[],
      specialDayRates: (Array.isArray(config.specialDayRates)
        ? config.specialDayRates
        : []) as unknown as SpecialDayRate[],
    };
  }

  // ── Special day matching ──

  private findSpecialDay(
    specialDayRates: SpecialDayRate[],
    at: Date,
  ): SpecialDayRate | null {
    if (!specialDayRates.length) return null;

    const day = at.getDay(); // 0=Sun, 6=Sat
    const todayStr =
      at.getFullYear() +
      '-' +
      String(at.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(at.getDate()).padStart(2, '0');

    for (const rate of specialDayRates) {
      // Weekend match
      if (rate.isWeekend && (day === 0 || day === 6)) {
        return rate;
      }
      // Holiday date match
      if (
        Array.isArray(rate.holidayDates) &&
        rate.holidayDates.includes(todayStr)
      ) {
        return rate;
      }
    }
    return null;
  }

  // ── Distance fare via bands (segmented) ──

  /**
   * Calculate distance fare using bands. Each km of the trip uses the rate
   * of the band it falls into.
   *
   * Example bands: [{minKm:0, maxKm:5, perKmRate:1000}, {minKm:5, maxKm:null, perKmRate:800}]
   * For a 7 km trip: (5 × 1000) + (2 × 800) = 6600
   *
   * If no bands, returns distanceKm × defaultPerKmRate.
   */
  private calcDistanceFareWithBands(
    distanceKm: number,
    defaultPerKmRate: number,
    bands: DistanceBand[],
  ): {
    total: number;
    segments: {
      minKm: number;
      maxKm: number;
      km: number;
      perKmRate: number;
      fare: number;
    }[];
  } {
    if (!bands.length) {
      return {
        total: distanceKm * defaultPerKmRate,
        segments: [
          {
            minKm: 0,
            maxKm: distanceKm,
            km: distanceKm,
            perKmRate: defaultPerKmRate,
            fare: distanceKm * defaultPerKmRate,
          },
        ],
      };
    }

    // Sort bands by minKm ascending
    const sorted = [...bands].sort((a, b) => a.minKm - b.minKm);

    let remaining = distanceKm;
    let cursor = 0;
    let total = 0;
    const segments: {
      minKm: number;
      maxKm: number;
      km: number;
      perKmRate: number;
      fare: number;
    }[] = [];

    for (const band of sorted) {
      if (remaining <= 0) break;

      const bandStart = band.minKm;
      const bandEnd = band.maxKm ?? Infinity;

      // Skip if cursor is past this band
      if (cursor >= bandEnd) continue;

      // Jump cursor to band start if needed
      if (cursor < bandStart) {
        // Gap between last band and this one -- use default rate
        const gapKm = Math.min(bandStart - cursor, remaining);
        if (gapKm > 0) {
          const fare = gapKm * defaultPerKmRate;
          total += fare;
          segments.push({
            minKm: cursor,
            maxKm: cursor + gapKm,
            km: gapKm,
            perKmRate: defaultPerKmRate,
            fare,
          });
          remaining -= gapKm;
          cursor += gapKm;
        }
      }

      if (remaining <= 0) break;

      const kmInBand = Math.min(bandEnd - cursor, remaining);
      if (kmInBand > 0) {
        const fare = kmInBand * band.perKmRate;
        total += fare;
        segments.push({
          minKm: cursor,
          maxKm: cursor + kmInBand,
          km: kmInBand,
          perKmRate: band.perKmRate,
          fare,
        });
        remaining -= kmInBand;
        cursor += kmInBand;
      }
    }

    // Any remaining distance beyond last band → use default rate
    if (remaining > 0) {
      const fare = remaining * defaultPerKmRate;
      total += fare;
      segments.push({
        minKm: cursor,
        maxKm: cursor + remaining,
        km: remaining,
        perKmRate: defaultPerKmRate,
        fare,
      });
    }

    return { total, segments };
  }

  // ── Peak-hour surge ──

  private getTimeSurge(timeRules: TimeRule[], at: Date): number {
    if (!timeRules.length) return 1.0;

    const hour = at.getHours();
    let maxMultiplier = 1.0;

    for (const rule of timeRules) {
      if (
        typeof rule.start !== 'number' ||
        typeof rule.end !== 'number' ||
        typeof rule.multiplier !== 'number'
      )
        continue;
      let end = rule.end;
      if (end < rule.start) end += 24;
      const hourWrap = hour >= rule.start ? hour : hour + 24;
      if (
        hourWrap >= rule.start &&
        hourWrap < end &&
        rule.multiplier > maxMultiplier
      ) {
        maxMultiplier = rule.multiplier;
      }
    }
    return maxMultiplier;
  }

  // ── Main calculation ──

  async calculateFare(
    distanceKm: number,
    durationMinutes: number,
    vehicleType: VehicleType = 'STANDARD',
    at: Date = new Date(),
  ): Promise<FareResult> {
    const config = await this.getConfig(vehicleType);

    // 1. Check special day
    const specialDay = this.findSpecialDay(config.specialDayRates, at);
    const isSpecialDay = specialDay !== null;

    // 2. Calculate distance fare
    let distanceResult: ReturnType<typeof this.calcDistanceFareWithBands>;

    if (isSpecialDay) {
      // Special day: use the special day's flat per-km rate (no bands)
      const sdRate = specialDay.perKmRate;
      distanceResult = {
        total: distanceKm * sdRate,
        segments: [
          {
            minKm: 0,
            maxKm: distanceKm,
            km: distanceKm,
            perKmRate: sdRate,
            fare: distanceKm * sdRate,
          },
        ],
      };
    } else {
      // Normal day: use distance bands (or default per-km)
      distanceResult = this.calcDistanceFareWithBands(
        distanceKm,
        config.perKmRate,
        config.distanceBands,
      );
    }

    const baseFare = config.baseFare;
    const distanceFare = distanceResult.total;
    const timeFare = durationMinutes * config.timeRate;
    const bookingFee = config.bookingFee;

    let subtotal = baseFare + distanceFare + timeFare + bookingFee;

    // 3. Surge (highest of config default or peak-hour rule)
    const timeSurge = this.getTimeSurge(config.timeRules, at);
    const effectiveSurge = Math.max(config.surgeMultiplier, timeSurge);
    subtotal *= effectiveSurge;

    // 4. Plus premium
    if (vehicleType === 'PLUS') {
      subtotal *= 1.2;
    }

    // 5. Round to nearest 100 MMK
    const totalFare = Math.ceil(subtotal / 100) * 100;

    // Effective per-km for the breakdown
    const effectivePerKm =
      distanceKm > 0 ? distanceFare / distanceKm : config.perKmRate;

    return {
      totalFare,
      baseFare,
      distanceFare,
      timeFare,
      bookingFee,
      surgeMultiplier: effectiveSurge,
      currency: config.currency,
      isSpecialDay,
      specialDayName: specialDay?.name ?? null,
      breakdown: {
        distanceKm,
        durationMinutes,
        effectivePerKmRate: Math.round(effectivePerKm),
        timeRate: config.timeRate,
        bandSegments: distanceResult.segments,
      },
    };
  }
}
