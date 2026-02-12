import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { MatchingService } from './matching.service.js';
import { AblyPublisherService } from './ably-publisher.service.js';

/**
 * Multi-round dispatch configuration.
 * Each round waits ROUND_INTERVAL_MS, then searches at the given radius.
 * Total ~3 minutes of retries before giving up.
 */
const ROUND_INTERVAL_MS = 20_000;

const DISPATCH_ROUNDS: { radiusMeters: number }[] = [
  { radiusMeters: 5_000 }, //  0s  →  5 km
  { radiusMeters: 8_000 }, // 20s  →  8 km
  { radiusMeters: 12_000 }, // 40s  → 12 km
  { radiusMeters: 15_000 }, // 60s  → 15 km
  { radiusMeters: 20_000 }, // 80s  → 20 km
  { radiusMeters: 25_000 }, // 100s → 25 km
  { radiusMeters: 30_000 }, // 120s → 30 km
  { radiusMeters: 30_000 }, // 140s → 30 km
  { radiusMeters: 30_000 }, // 160s → 30 km  (~3 min total)
];

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
}

/** In-memory tracking for active dispatches. */
interface ActiveDispatch {
  timer: ReturnType<typeof setTimeout> | null;
  notifiedUserIds: Set<string>;
  passengerId: string;
  roundIndex: number;
  payload: DispatchPayload;
  pickupLat: number;
  pickupLng: number;
}

@Injectable()
export class RideDispatchService {
  private readonly logger = new Logger(RideDispatchService.name);
  private readonly activeDispatches = new Map<string, ActiveDispatch>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
    private readonly publisher: AblyPublisherService,
  ) {}

  /**
   * Dispatch a newly-created ride to the nearest ONLINE drivers.
   * Runs up to 9 rounds over ~3 minutes, expanding the search radius.
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
    };

    const dispatch: ActiveDispatch = {
      timer: null,
      notifiedUserIds: new Set<string>(),
      passengerId: ride.passengerId,
      roundIndex: 0,
      payload,
      pickupLat: ride.pickupLat,
      pickupLng: ride.pickupLng,
    };

    this.activeDispatches.set(ride.id, dispatch);

    // Start the first round immediately
    await this.dispatchRound(ride.id);
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
    for (const userId of dispatch.notifiedUserIds) {
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

    const roundCfg = DISPATCH_ROUNDS[dispatch.roundIndex];
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
      `Ride ${rideId}: dispatch round ${dispatch.roundIndex + 1}/${DISPATCH_ROUNDS.length} ` +
        `(radius ${roundCfg.radiusMeters}m)`,
    );

    // Find drivers within this round's radius
    const drivers = await this.matching.findNearbyDrivers(
      dispatch.pickupLat,
      dispatch.pickupLng,
      roundCfg.radiusMeters,
    );

    // Notify only drivers who haven't been notified yet
    let newNotifications = 0;
    for (const driver of drivers) {
      if (dispatch.notifiedUserIds.has(driver.userId)) continue;

      await this.publisher.publish(
        `driver:private:${driver.userId}`,
        'new_ride_request',
        dispatch.payload,
      );
      dispatch.notifiedUserIds.add(driver.userId);
      newNotifications++;
    }

    this.logger.log(
      `Ride ${rideId}: notified ${newNotifications} new driver(s) ` +
        `(${dispatch.notifiedUserIds.size} total)`,
    );

    // Move to next round
    dispatch.roundIndex++;

    if (dispatch.roundIndex < DISPATCH_ROUNDS.length) {
      // Schedule the next round
      dispatch.timer = setTimeout(() => {
        void this.dispatchRound(rideId);
      }, ROUND_INTERVAL_MS);
    } else {
      // Schedule final expiry check after one more interval
      dispatch.timer = setTimeout(() => {
        void this.handleAllRoundsExhausted(rideId);
      }, ROUND_INTERVAL_MS);
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

    this.logger.warn(
      `Ride ${rideId}: all ${DISPATCH_ROUNDS.length} dispatch rounds exhausted — no driver accepted`,
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
