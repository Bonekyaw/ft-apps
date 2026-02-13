import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { MatchingService, type DriverMatchFilters } from './matching.service.js';
import { AblyPublisherService } from './ably-publisher.service.js';
import { PricingCacheService } from '../pricing/pricing-cache.service.js';

/** Payload published to each driver's private Ably channel. */
interface DispatchPayload {
  rideId: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  estimatedFare: number;
  currency: string;
  vehicleType: string;
  passengerNote: string | null;
  pickupPhotoUrl: string | null;
  extraPassengers: boolean;
}

/** In-memory tracking for active dispatches. */
interface ActiveDispatch {
  timer: ReturnType<typeof setTimeout> | null;
  /** userId → timestamp of last notification (allows time-based re-notify). */
  notifiedDriverTs: Map<string, number>;
  /** Drivers who explicitly skipped — never re-notify. */
  skippedUserIds: Set<string>;
  passengerId: string;
  roundIndex: number;
  payload: DispatchPayload;
  pickupLat: number;
  pickupLng: number;
  /** Rider preference filters forwarded to the matching service. */
  filters: DriverMatchFilters;
}

@Injectable()
export class RideDispatchService {
  private readonly logger = new Logger(RideDispatchService.name);
  private readonly activeDispatches = new Map<string, ActiveDispatch>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
    private readonly publisher: AblyPublisherService,
    private readonly cache: PricingCacheService,
  ) {}

  /**
   * Dispatch a newly-created ride to the nearest ONLINE drivers.
   * Runs configurable rounds (set by admin), expanding the search radius.
   * Should be called fire-and-forget after the ride is persisted.
   */
  async dispatchRide(ride: {
    id: string;
    passengerId: string;
    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;
    dropoffAddress: string;
    dropoffLat: number;
    dropoffLng: number;
    totalFare: number;
    currency: string;
    vehicleType: string;
    passengerNote: string | null;
    pickupPhotoUrl: string | null;
    fuelPreference?: string | null;
    petFriendly?: boolean;
    extraPassengers?: boolean;
  }): Promise<void> {
    const payload: DispatchPayload = {
      rideId: ride.id,
      pickupAddress: ride.pickupAddress,
      pickupLat: ride.pickupLat,
      pickupLng: ride.pickupLng,
      dropoffAddress: ride.dropoffAddress,
      dropoffLat: ride.dropoffLat,
      dropoffLng: ride.dropoffLng,
      estimatedFare: ride.totalFare,
      currency: ride.currency,
      vehicleType: ride.vehicleType,
      passengerNote: ride.passengerNote,
      pickupPhotoUrl: ride.pickupPhotoUrl,
      extraPassengers: ride.extraPassengers ?? false,
    };

    const filters: DriverMatchFilters = {
      vehicleType: ride.vehicleType,
      fuelType: ride.fuelPreference ?? null,
      petFriendly: ride.petFriendly ?? false,
      extraPassengers: ride.extraPassengers ?? false,
    };

    const dispatch: ActiveDispatch = {
      timer: null,
      notifiedDriverTs: new Map<string, number>(),
      skippedUserIds: new Set<string>(),
      passengerId: ride.passengerId,
      roundIndex: 0,
      payload,
      pickupLat: ride.pickupLat,
      pickupLng: ride.pickupLng,
      filters,
    };

    this.activeDispatches.set(ride.id, dispatch);

    // Start the first round immediately
    await this.dispatchRound(ride.id);
  }

  /**
   * Mark a driver as having explicitly skipped/rejected this ride.
   * They will NOT be re-notified in subsequent rounds.
   */
  markDriverSkipped(rideId: string, userId: string): void {
    const dispatch = this.activeDispatches.get(rideId);
    if (!dispatch) return;
    dispatch.skippedUserIds.add(userId);
    this.logger.log(`Ride ${rideId}: driver ${userId} marked as skipped`);
  }

  /**
   * Cancel an active dispatch (called when a driver accepts the ride).
   * Clears the scheduled next-round timer and notifies other drivers.
   */
  cancelDispatch(rideId: string): void {
    const dispatch = this.activeDispatches.get(rideId);
    if (!dispatch) return;

    if (dispatch.timer) clearTimeout(dispatch.timer);
    this.activeDispatches.delete(rideId);

    // Notify all previously-notified drivers that the ride is no longer available
    for (const userId of dispatch.notifiedDriverTs.keys()) {
      void this.publisher.publish(
        `driver:private:${userId}`,
        'ride_cancelled',
        { rideId },
      );
    }
  }

  // ── Private helpers ──────────────────────────────────────

  /**
   * Execute a single dispatch round: find drivers, notify new ones,
   * and schedule the next round (or give up if all rounds exhausted).
   */
  private async dispatchRound(rideId: string): Promise<void> {
    const dispatch = this.activeDispatches.get(rideId);
    if (!dispatch) return; // Cancelled between scheduling and execution

    const rounds = this.cache.getDispatchRounds();
    const roundCfg = rounds[dispatch.roundIndex];
    if (!roundCfg) {
      // All rounds exhausted — give up
      await this.handleAllRoundsExhausted(rideId);
      return;
    }

    // Check that ride is still PENDING (could have been accepted since scheduling)
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      select: { status: true },
    });

    if (!ride || ride.status !== 'PENDING') {
      this.activeDispatches.delete(rideId);
      return;
    }

    this.logger.log(
      `Ride ${rideId}: dispatch round ${dispatch.roundIndex + 1}/${rounds.length} ` +
        `(radius ${roundCfg.radiusMeters}m)`,
    );

    // Find drivers within this round's radius (with rider preference filters)
    const drivers = await this.matching.findNearbyDrivers(
      dispatch.pickupLat,
      dispatch.pickupLng,
      roundCfg.radiusMeters,
      5,
      dispatch.filters,
    );

    // Notify drivers who haven't skipped AND haven't been notified recently.
    // If a driver was notified more than the round interval ago and didn't
    // respond, re-send (their modal countdown has expired by now).
    const intervalMs = roundCfg.intervalMs;
    const now = Date.now();
    let newNotifications = 0;
    for (const driver of drivers) {
      // Never re-notify drivers who explicitly rejected this ride
      if (dispatch.skippedUserIds.has(driver.userId)) continue;

      // Skip if notified recently (within this round interval)
      const lastNotifiedAt = dispatch.notifiedDriverTs.get(driver.userId);
      if (lastNotifiedAt && now - lastNotifiedAt < intervalMs) continue;

      await this.publisher.publish(
        `driver:private:${driver.userId}`,
        'new_ride_request',
        dispatch.payload,
      );
      dispatch.notifiedDriverTs.set(driver.userId, now);
      newNotifications++;
    }

    this.logger.log(
      `Ride ${rideId}: notified ${newNotifications} driver(s) this round ` +
        `(${dispatch.notifiedDriverTs.size} tracked, ${dispatch.skippedUserIds.size} skipped)`,
    );

    // Move to next round
    dispatch.roundIndex++;

    if (dispatch.roundIndex < rounds.length) {
      // Schedule the next round using the CURRENT round's interval
      dispatch.timer = setTimeout(() => {
        void this.dispatchRound(rideId);
      }, intervalMs);
    } else {
      // Schedule final expiry check after one more interval
      dispatch.timer = setTimeout(() => {
        void this.handleAllRoundsExhausted(rideId);
      }, intervalMs);
    }
  }

  /** All dispatch rounds exhausted — cancel ride and notify rider. */
  private async handleAllRoundsExhausted(rideId: string): Promise<void> {
    const dispatch = this.activeDispatches.get(rideId);
    this.activeDispatches.delete(rideId);

    // Re-check ride status
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      select: { status: true, passengerId: true },
    });

    if (!ride || ride.status !== 'PENDING') return;

    const totalRounds = this.cache.getDispatchRounds().length;
    this.logger.warn(
      `Ride ${rideId}: all ${totalRounds} dispatch rounds exhausted — no driver accepted`,
    );

    await this.prisma.ride.update({
      where: { id: rideId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    const passengerId = dispatch?.passengerId ?? ride.passengerId;
    await this.publisher.publish(`rider:${passengerId}`, 'no_driver_found', {
      rideId,
    });
  }
}
