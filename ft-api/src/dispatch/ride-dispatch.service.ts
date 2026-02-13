import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import {
  MatchingService,
  type DriverMatchFilters,
  type NearbyDriver,
} from './matching.service.js';
import { AblyPublisherService } from './ably-publisher.service.js';
import { PricingCacheService } from '../pricing/pricing-cache.service.js';
import { PenaltyService } from './penalty.service.js';

/** How long (ms) to wait for a single driver to respond. */
const DRIVER_TIMEOUT_MS = 15_000;

/** Maximum total time (ms) to keep searching before giving up. */
const MAX_DISPATCH_DURATION_MS = 2 * 60 * 1000; // 2 minutes

/** Delay (ms) between full-cycle retries when all rounds are exhausted. */
const RETRY_DELAY_MS = 10_000; // 10 seconds

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

/** In-memory tracking for an active sequential dispatch. */
interface ActiveDispatch {
  timer: ReturnType<typeof setTimeout> | null;
  /** All driver userIds ever notified (persisted to DB for restart resilience). */
  notifiedDriverIds: Set<string>;
  /** Drivers who explicitly skipped/rejected — never re-notify in the same cycle. */
  skippedUserIds: Set<string>;
  passengerId: string;
  roundIndex: number;
  /** Sorted driver queue for the current round (already filtered). */
  driverQueue: NearbyDriver[];
  /** Index into driverQueue for the next driver to contact. */
  currentDriverIdx: number;
  /** userId of the driver currently being offered the ride (awaiting response). */
  currentDriverUserId: string | null;
  payload: DispatchPayload;
  pickupLat: number;
  pickupLng: number;
  /** Rider preference filters forwarded to the matching service. */
  filters: DriverMatchFilters;
  /** Timestamp (ms) when the dispatch was first created — used for the 2-min cap. */
  startedAt: number;
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
    private readonly penalty: PenaltyService,
  ) {}

  // ── Public API ─────────────────────────────────────────────

  /**
   * Dispatch a newly-created ride using a sequential one-by-one waterfall.
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
    /** Rider's vehicle type preference for matching (null = any driver). */
    vehicleTypePreference?: string | null;
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

    // Use the rider's vehicle type PREFERENCE for matching (not the fare tier).
    // When the preference is null/undefined, no vehicle type filter is applied,
    // so any driver (STANDARD, PLUS, VIP) can be matched.
    const filters: DriverMatchFilters = {
      vehicleType: ride.vehicleTypePreference ?? null,
      fuelType: ride.fuelPreference ?? null,
      petFriendly: ride.petFriendly ?? false,
      extraPassengers: ride.extraPassengers ?? false,
    };

    // Seed notified set from DB (restart resilience)
    const existing = await this.prisma.ride.findUnique({
      where: { id: ride.id },
      select: { notifiedDriverIds: true },
    });
    const seeded = new Set<string>(existing?.notifiedDriverIds ?? []);

    const dispatch: ActiveDispatch = {
      timer: null,
      notifiedDriverIds: seeded,
      skippedUserIds: new Set<string>(),
      passengerId: ride.passengerId,
      roundIndex: 0,
      driverQueue: [],
      currentDriverIdx: 0,
      currentDriverUserId: null,
      payload,
      pickupLat: ride.pickupLat,
      pickupLng: ride.pickupLng,
      filters,
      startedAt: Date.now(),
    };

    this.activeDispatches.set(ride.id, dispatch);

    this.logger.log(
      `Ride ${ride.id}: dispatch started — fare vehicleType=${ride.vehicleType}, matching filter vehicleType=${filters.vehicleType ?? 'ANY (no filter)'}`,
    );

    // Start the first round immediately
    await this.startRound(ride.id);
  }

  /**
   * Mark a driver as having explicitly skipped/rejected this ride.
   * If that driver is the one currently being waited on, immediately
   * advance to the next driver in the queue.
   */
  markDriverSkipped(rideId: string, userId: string): void {
    const dispatch = this.activeDispatches.get(rideId);
    if (!dispatch) return;

    dispatch.skippedUserIds.add(userId);
    this.logger.log(`Ride ${rideId}: driver ${userId} marked as skipped`);

    // If this is the driver we're currently waiting on, skip them immediately
    if (dispatch.currentDriverUserId === userId) {
      if (dispatch.timer) clearTimeout(dispatch.timer);
      dispatch.timer = null;
      dispatch.currentDriverUserId = null;

      // Notify the skipped driver that the ride is no longer for them
      void this.publisher.publish(
        `driver:private:${userId}`,
        'ride_cancelled',
        { rideId },
      );

      void this.notifyNextDriver(rideId);
    }
  }

  /**
   * Reset the 15-second driver timeout for a ride.
   * Called when the driver app actually starts displaying a request
   * that was queued behind another request. Returns true if the timer
   * was successfully reset, false if the dispatch already moved past
   * this driver.
   */
  resetDriverTimer(rideId: string, driverUserId: string): boolean {
    const dispatch = this.activeDispatches.get(rideId);
    if (!dispatch) return false;

    // Only reset if this driver is still the one being waited on
    if (dispatch.currentDriverUserId !== driverUserId) {
      this.logger.log(
        `Ride ${rideId}: acknowledge from ${driverUserId} ignored — ` +
          `current driver is ${dispatch.currentDriverUserId ?? 'none'}`,
      );
      return false;
    }

    // Clear the old timer and start a fresh 15-second window
    if (dispatch.timer) clearTimeout(dispatch.timer);

    this.logger.log(
      `Ride ${rideId}: timer reset for driver ${driverUserId} (fresh ${DRIVER_TIMEOUT_MS / 1000}s)`,
    );

    dispatch.timer = setTimeout(() => {
      dispatch.timer = null;

      this.logger.log(
        `Ride ${rideId}: driver ${driverUserId} timed out after ${DRIVER_TIMEOUT_MS / 1000}s (reset)`,
      );

      void this.publisher.publish(
        `driver:private:${driverUserId}`,
        'ride_cancelled',
        { rideId },
      );

      void this.penalty.recordRejection(driverUserId);

      dispatch.currentDriverUserId = null;
      void this.notifyNextDriver(rideId);
    }, DRIVER_TIMEOUT_MS);

    return true;
  }

  /**
   * Cancel an active dispatch (called when a driver accepts the ride).
   * Clears the pending timer and notifies only the currently-waiting
   * driver (if different from the one who accepted) that the ride is gone.
   */
  cancelDispatch(rideId: string): void {
    const dispatch = this.activeDispatches.get(rideId);
    if (!dispatch) return;

    if (dispatch.timer) clearTimeout(dispatch.timer);
    this.activeDispatches.delete(rideId);

    // Notify the currently-waiting driver (if any) that the ride was taken
    if (dispatch.currentDriverUserId) {
      void this.publisher.publish(
        `driver:private:${dispatch.currentDriverUserId}`,
        'ride_cancelled',
        { rideId },
      );
    }
  }

  // ── Private helpers ────────────────────────────────────────

  /**
   * Start a new dispatch round: fetch eligible drivers for this round's
   * radius, filter out already-notified/skipped ones, then begin the
   * sequential notification waterfall.
   */
  private async startRound(rideId: string): Promise<void> {
    const dispatch = this.activeDispatches.get(rideId);
    if (!dispatch) return;

    const rounds = this.cache.getDispatchRounds();
    const roundCfg = rounds[dispatch.roundIndex];
    if (!roundCfg) {
      await this.handleAllRoundsExhausted(rideId);
      return;
    }

    // Check that ride is still PENDING
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      select: { status: true },
    });

    if (!ride || ride.status !== 'PENDING') {
      this.activeDispatches.delete(rideId);
      return;
    }

    this.logger.log(
      `Ride ${rideId}: starting round ${dispatch.roundIndex + 1}/${rounds.length} ` +
        `(radius ${roundCfg.radiusMeters}m)`,
    );

    // Fetch priority-sorted eligible drivers
    const allDrivers = await this.matching.findNearbyDrivers(
      dispatch.pickupLat,
      dispatch.pickupLng,
      roundCfg.radiusMeters,
      10, // fetch more than we need so we have backup after filtering
      dispatch.filters,
    );

    // Filter out drivers already notified or skipped
    const eligible = allDrivers.filter(
      (d) =>
        !dispatch.notifiedDriverIds.has(d.userId) &&
        !dispatch.skippedUserIds.has(d.userId),
    );

    this.logger.log(
      `Ride ${rideId}: round ${dispatch.roundIndex + 1} found ${allDrivers.length} driver(s), ` +
        `${eligible.length} eligible after filtering`,
    );

    dispatch.driverQueue = eligible;
    dispatch.currentDriverIdx = 0;
    dispatch.currentDriverUserId = null;

    // Begin the sequential waterfall for this round
    await this.notifyNextDriver(rideId);
  }

  /**
   * Core sequential logic: notify the next driver in the queue, or
   * advance to the next round if all drivers in this round are exhausted.
   */
  private async notifyNextDriver(rideId: string): Promise<void> {
    const dispatch = this.activeDispatches.get(rideId);
    if (!dispatch) return;

    // ── All drivers in this round exhausted → next round ──
    if (dispatch.currentDriverIdx >= dispatch.driverQueue.length) {
      dispatch.roundIndex++;
      await this.startRound(rideId);
      return;
    }

    // ── Re-check ride is still PENDING ──
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      select: { status: true },
    });
    if (!ride || ride.status !== 'PENDING') {
      this.activeDispatches.delete(rideId);
      return;
    }

    // ── Pick the next driver ──
    const driver = dispatch.driverQueue[dispatch.currentDriverIdx];
    dispatch.currentDriverIdx++;

    // Double-check they haven't been skipped/notified in the meantime
    if (
      dispatch.skippedUserIds.has(driver.userId) ||
      dispatch.notifiedDriverIds.has(driver.userId)
    ) {
      // Skip and try the next one immediately (no await needed for recursion safety)
      void this.notifyNextDriver(rideId);
      return;
    }

    this.logger.log(
      `Ride ${rideId}: notifying driver ${driver.userId} (${driver.driverName})` +
        `${driver.isVip ? ' [VIP]' : ''}`,
    );

    // 1. Send ride request to the driver
    await this.publisher.publish(
      `driver:private:${driver.userId}`,
      'new_ride_request',
      dispatch.payload,
    );

    // 2. Notify the rider about the current driver being contacted
    //    NOTE: VIP status is intentionally hidden from riders.
    await this.publisher.publish(
      `rider:${dispatch.passengerId}`,
      'dispatch_progress',
      {
        rideId,
        driverName: driver.driverName,
      },
    );

    // 3. Track the notification
    dispatch.currentDriverUserId = driver.userId;
    dispatch.notifiedDriverIds.add(driver.userId);

    // 4. Persist notifiedDriverIds to DB
    const allIds = Array.from(dispatch.notifiedDriverIds);
    void this.prisma.ride
      .update({
        where: { id: rideId },
        data: { notifiedDriverIds: allIds },
      })
      .catch((err: unknown) =>
        this.logger.warn(
          `Failed to persist notifiedDriverIds for ride ${rideId}: ${err}`,
        ),
      );

    // 5. Start the 15-second timeout
    //    NOTE: We intentionally do NOT send ride_cancelled to the driver on
    //    timeout. The driver app has its own 15-second countdown that handles
    //    dismissal via skipRide(). Sending ride_cancelled here would destroy
    //    queued requests from other dispatch pipelines that the driver hasn't
    //    seen yet (both timers fire at ~T=15s, the first promotes the queued
    //    request, the second immediately kills it).
    dispatch.timer = setTimeout(() => {
      dispatch.timer = null;

      this.logger.log(
        `Ride ${rideId}: driver ${driver.userId} timed out after ${DRIVER_TIMEOUT_MS / 1000}s`,
      );

      // Timeout counts as a rejection for non-VIP penalty tracking.
      // VIP drivers are exempt (checked inside recordRejection).
      void this.penalty.recordRejection(driver.userId);

      dispatch.currentDriverUserId = null;

      // Move to the next driver
      void this.notifyNextDriver(rideId);
    }, DRIVER_TIMEOUT_MS);
  }

  /**
   * All dispatch rounds exhausted for one cycle.
   * If within the 2-minute window, reset and retry from round 1.
   * If 2 minutes have elapsed, give up and notify the rider.
   */
  private async handleAllRoundsExhausted(rideId: string): Promise<void> {
    const dispatch = this.activeDispatches.get(rideId);
    if (!dispatch) return;

    const elapsed = Date.now() - dispatch.startedAt;

    // ── Still within the 2-minute window → retry ──
    if (elapsed < MAX_DISPATCH_DURATION_MS) {
      const totalRounds = this.cache.getDispatchRounds().length;
      this.logger.log(
        `Ride ${rideId}: all ${totalRounds} rounds exhausted (${Math.round(elapsed / 1000)}s elapsed). ` +
          `Retrying in ${RETRY_DELAY_MS / 1000}s…`,
      );

      // Keep both notifiedDriverIds and skippedUserIds intact so drivers
      // who already saw this ride are never re-notified. The retry only
      // picks up NEW drivers who came online or entered the search radius.
      dispatch.roundIndex = 0;

      // Tell the rider to clear the stale "Contacting X" display
      void this.publisher.publish(
        `rider:${dispatch.passengerId}`,
        'dispatch_waiting',
        { rideId },
      );

      // Wait before retrying to avoid spamming drivers immediately
      dispatch.timer = setTimeout(() => {
        dispatch.timer = null;
        void this.startRound(rideId);
      }, RETRY_DELAY_MS);

      return;
    }

    // ── 2 minutes exceeded → give up ──
    this.activeDispatches.delete(rideId);

    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      select: { status: true, passengerId: true },
    });

    if (!ride || ride.status !== 'PENDING') return;

    this.logger.warn(
      `Ride ${rideId}: no driver found after ${Math.round(elapsed / 1000)}s — giving up`,
    );

    await this.prisma.ride.update({
      where: { id: rideId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    const passengerId = dispatch.passengerId ?? ride.passengerId;
    await this.publisher.publish(`rider:${passengerId}`, 'no_driver_found', {
      rideId,
    });
  }
}
