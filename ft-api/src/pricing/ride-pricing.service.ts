import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

const DEFAULT_BASE_FARE_MIN_MMKT = 1500;
const DEFAULT_BASE_FARE_MAX_MMKT = 2000;
const DEFAULT_INITIAL_KM = 2;
const DEFAULT_PER_KM_MMKT = 1000;
const DEFAULT_TAXI_PLUS_MULTIPLIER = 1.2;

export interface FareResult {
  standardMmkt: number;
  taxiPlusMmkt: number;
  baseFareMmkt: number;
  distanceFareMmkt: number;
  effectivePerKmMmkt: number;
  surgeMultiplier: number;
  currency: string;
}

@Injectable()
export class RidePricingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get default config (single row). Uses in-memory defaults if no row exists.
   */
  private async getDefaults(): Promise<{
    baseFareMinMmkt: number;
    baseFareMaxMmkt: number;
    initialKmForBase: number;
    perKmRateDefaultMmkt: number;
    taxiPlusMultiplier: number;
    currency: string;
  }> {
    const row = await this.prisma.pricingDefaults.findFirst();
    if (!row) {
      return {
        baseFareMinMmkt: DEFAULT_BASE_FARE_MIN_MMKT,
        baseFareMaxMmkt: DEFAULT_BASE_FARE_MAX_MMKT,
        initialKmForBase: DEFAULT_INITIAL_KM,
        perKmRateDefaultMmkt: DEFAULT_PER_KM_MMKT,
        taxiPlusMultiplier: Number(DEFAULT_TAXI_PLUS_MULTIPLIER),
        currency: 'MMK',
      };
    }
    return {
      baseFareMinMmkt: Number(row.baseFareMinMmkt),
      baseFareMaxMmkt: Number(row.baseFareMaxMmkt),
      initialKmForBase: Number(row.initialKmForBase),
      perKmRateDefaultMmkt: Number(row.perKmRateDefaultMmkt),
      taxiPlusMultiplier: Number(row.taxiPlusMultiplier),
      currency: row.currency,
    };
  }

  /**
   * Base fare in MMK: interpolated between min and max based on initial distance (e.g. first 2 km).
   * More initial km -> higher base (up to max).
   */
  private baseFareForInitialKm(
    baseFareMin: number,
    baseFareMax: number,
    initialKm: number,
  ): number {
    if (initialKm <= 0) return baseFareMin;
    const t = Math.min(1, initialKm / 3); // 0–3 km band maps to min–max
    return Math.round(baseFareMin + t * (baseFareMax - baseFareMin));
  }

  /**
   * Resolve effective per-km rate (MMK) and surge multiplier from active rules.
   * Rules applied by priority (lower first). Distance band sets perKm; time/special set multiplier.
   */
  private async resolvePerKmAndSurge(
    distanceKm: number,
    at: Date,
  ): Promise<{ perKmMmkt: number; surgeMultiplier: number }> {
    const defaults = await this.getDefaults();
    let perKmMmkt = defaults.perKmRateDefaultMmkt;
    let surgeMultiplier = 1;

    const rules = await this.prisma.pricingRule.findMany({
      where: { active: true },
      orderBy: { priority: 'asc' },
    });

    for (const r of rules) {
      const type = r.ruleType;

      if (type === 'DISTANCE_BAND') {
        const min = r.minDistanceKm != null ? Number(r.minDistanceKm) : 0;
        const max =
          r.maxDistanceKm != null ? Number(r.maxDistanceKm) : Infinity;
        if (distanceKm >= min && distanceKm < max && r.perKmRateMmkt != null) {
          perKmMmkt = Number(r.perKmRateMmkt);
        }
      }

      if (type === 'TIME_OF_DAY' && r.startHour != null && r.endHour != null && r.timeSurgeMultiplier != null) {
        const hour = at.getHours();
        const start = r.startHour;
        let end = r.endHour;
        if (end < start) end += 24;
        const hourWrap = hour >= start ? hour : hour + 24;
        if (hourWrap >= start && hourWrap <= end) {
          surgeMultiplier *= Number(r.timeSurgeMultiplier);
        }
      }

      if (type === 'SPECIAL_DAY') {
        let apply = false;
        if (r.isWeekend === true) {
          const day = at.getDay();
          if (day === 0 || day === 6) apply = true;
        }
        if (r.dayOfWeek != null && at.getDay() === r.dayOfWeek) apply = true;
        if (r.holidayDate != null) {
          const d = new Date(r.holidayDate);
          if (
            d.getUTCDate() === at.getUTCDate() &&
            d.getUTCMonth() === at.getUTCMonth() &&
            d.getUTCFullYear() === at.getUTCFullYear()
          ) {
            apply = true;
          }
        }
        if (apply && r.specialDayMultiplier != null) {
          surgeMultiplier *= Number(r.specialDayMultiplier);
        }
      }
    }

    return { perKmMmkt, surgeMultiplier };
  }

  /**
   * Compute fare for a given distance and duration.
   * Base fare covers initial km; remaining distance charged at effective per-km (with surge).
   */
  async calculateFare(
    distanceMeters: number,
    _durationSeconds: number,
    at: Date = new Date(),
  ): Promise<FareResult> {
    const defaults = await this.getDefaults();
    const distanceKm = distanceMeters / 1000;

    const baseFareMmkt = this.baseFareForInitialKm(
      defaults.baseFareMinMmkt,
      defaults.baseFareMaxMmkt,
      defaults.initialKmForBase,
    );

    const { perKmMmkt, surgeMultiplier } = await this.resolvePerKmAndSurge(
      distanceKm,
      at,
    );

    const kmBeyondInitial = Math.max(
      0,
      distanceKm - defaults.initialKmForBase,
    );
    const distanceFareMmkt = Math.round(kmBeyondInitial * perKmMmkt);
    const subtotal = baseFareMmkt + distanceFareMmkt;
    const standardMmkt = Math.round(subtotal * surgeMultiplier);
    const taxiPlusMmkt = Math.round(
      standardMmkt * defaults.taxiPlusMultiplier,
    );

    return {
      standardMmkt,
      taxiPlusMmkt,
      baseFareMmkt,
      distanceFareMmkt,
      effectivePerKmMmkt: perKmMmkt,
      surgeMultiplier,
      currency: defaults.currency,
    };
  }
}
