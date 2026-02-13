import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

// ── Cached shapes ──

export interface CachedPricingConfig {
  baseFare: number;
  perKmRate: number;
  timeRate: number;
  bookingFee: number;
  surgeMultiplier: number;
  currency: string;
  vehicleType: string;
  timeRules: unknown[];
  distanceBands: unknown[];
  specialDayRates: unknown[];
}

export interface CachedTownshipRule {
  township: string;
  fixedCharge: number;
}

export interface CachedDispatchRound {
  roundIndex: number;
  radiusMeters: number;
  intervalMs: number;
}

/**
 * In-memory cache for all pricing configuration and township surcharge rules.
 * Loaded eagerly on startup and invalidated explicitly when admin updates occur.
 */
@Injectable()
export class PricingCacheService implements OnModuleInit {
  private readonly logger = new Logger(PricingCacheService.name);

  /** PricingConfig keyed by vehicleType (uppercase). */
  private configMap = new Map<string, CachedPricingConfig>();

  /** Township surcharge rules keyed by lowercase township name. */
  private townshipMap = new Map<string, number>();

  /** Dispatch rounds sorted by roundIndex. */
  private dispatchRounds: CachedDispatchRound[] = [];

  /** Hard-coded fallback when DB has no dispatch config rows. */
  private static readonly DEFAULT_DISPATCH_ROUNDS: CachedDispatchRound[] = [
    { roundIndex: 0, radiusMeters: 800, intervalMs: 20_000 },
    { roundIndex: 1, radiusMeters: 1_500, intervalMs: 20_000 },
    { roundIndex: 2, radiusMeters: 2_500, intervalMs: 20_000 },
  ];

  constructor(private readonly prisma: PrismaService) {}

  // ── Lifecycle ──

  async onModuleInit() {
    await this.refreshAll();
  }

  /** Reload all caches from the database. */
  async refreshAll() {
    await Promise.all([
      this.refreshPricingConfigs(),
      this.refreshTownshipRules(),
      this.refreshDispatchConfig(),
    ]);
    this.logger.log(
      `Cache refreshed: ${this.configMap.size} pricing configs, ` +
        `${this.townshipMap.size} township rules, ` +
        `${this.dispatchRounds.length} dispatch rounds`,
    );
  }

  // ── PricingConfig ──

  async refreshPricingConfigs() {
    const rows = await this.prisma.pricingConfig.findMany();
    const next = new Map<string, CachedPricingConfig>();

    for (const r of rows) {
      next.set(r.vehicleType, {
        baseFare: Number(r.baseFare),
        perKmRate: Number(r.perKmRate),
        timeRate: Number(r.timeRate),
        bookingFee: Number(r.bookingFee),
        surgeMultiplier: Number(r.surgeMultiplier),
        currency: r.currency,
        vehicleType: r.vehicleType,
        timeRules: Array.isArray(r.timeRules) ? (r.timeRules as unknown[]) : [],
        distanceBands: Array.isArray(r.distanceBands)
          ? (r.distanceBands as unknown[])
          : [],
        specialDayRates: Array.isArray(r.specialDayRates)
          ? (r.specialDayRates as unknown[])
          : [],
      });
    }

    this.configMap = next;
  }

  /**
   * Get a cached PricingConfig for the given vehicle type.
   * Falls back to STANDARD, then to hard-coded defaults.
   */
  getConfig(vehicleType: string = 'STANDARD'): CachedPricingConfig {
    const exact = this.configMap.get(vehicleType);
    if (exact) return exact;

    if (vehicleType !== 'STANDARD') {
      const fallback = this.configMap.get('STANDARD');
      if (fallback) return fallback;
    }

    // Hard-coded defaults if DB is empty
    return {
      baseFare: 1500,
      perKmRate: 1000,
      timeRate: 0,
      bookingFee: 0,
      surgeMultiplier: 1.0,
      currency: 'MMK',
      vehicleType: 'STANDARD',
      timeRules: [],
      distanceBands: [],
      specialDayRates: [],
    };
  }

  // ── Township surcharge ──

  async refreshTownshipRules() {
    const rows = await this.prisma.townshipSurcharge.findMany();
    const next = new Map<string, number>();
    for (const r of rows) {
      next.set(r.township.trim().toLowerCase(), Number(r.fixedCharge));
    }
    this.townshipMap = next;
  }

  /**
   * Calculate the total township surcharge for a trip.
   *
   * Logic:
   * - If origin and destination are the same township → 0 (intra-township).
   * - If the origin township has a rule → add its fixedCharge.
   * - If the destination township has a rule → add its fixedCharge.
   * - If neither has a rule → 0.
   */
  getTownshipCharge(originTownship: string, destTownship: string): number {
    const normOrigin = originTownship.trim().toLowerCase();
    const normDest = destTownship.trim().toLowerCase();

    // Same township → no surcharge
    if (normOrigin === normDest) return 0;

    let total = 0;
    const originCharge = this.townshipMap.get(normOrigin);
    if (originCharge !== undefined) total += originCharge;

    const destCharge = this.townshipMap.get(normDest);
    if (destCharge !== undefined) total += destCharge;

    return total;
  }

  // ── Dispatch config ──

  async refreshDispatchConfig() {
    const rows = await this.prisma.dispatchConfig.findMany({
      orderBy: { roundIndex: 'asc' },
    });

    if (rows.length === 0) {
      this.dispatchRounds = PricingCacheService.DEFAULT_DISPATCH_ROUNDS;
      return;
    }

    this.dispatchRounds = rows.map((r) => ({
      roundIndex: r.roundIndex,
      radiusMeters: r.radiusMeters,
      intervalMs: r.intervalMs,
    }));
  }

  /** Get cached dispatch rounds (never empty — falls back to defaults). */
  getDispatchRounds(): CachedDispatchRound[] {
    return this.dispatchRounds.length > 0
      ? this.dispatchRounds
      : PricingCacheService.DEFAULT_DISPATCH_ROUNDS;
  }
}
