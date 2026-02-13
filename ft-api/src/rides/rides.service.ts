import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { VehicleType } from '../generated/prisma/enums.js';
import { DriverStatusService } from '../dispatch/driver-status.service.js';
import { RideDispatchService } from '../dispatch/ride-dispatch.service.js';
import { AblyPublisherService } from '../dispatch/ably-publisher.service.js';
import { PenaltyService } from '../dispatch/penalty.service.js';

interface CreateRideInput {
  pickupAddress: string;
  pickupMainText?: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffMainText?: string;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: VehicleType;
  passengerNote?: string;
  pickupPhotoUrl?: string;
  /** Required — all fares come from a server-persisted RouteQuote. */
  routeQuoteId: string;
  /** Rider's vehicle type preference for matching (null = any driver). */
  vehicleTypePreference?: string;
  fuelPreference?: string;
  petFriendly?: boolean;
  extraPassengers?: boolean;
}

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly driverStatus: DriverStatusService,
    private readonly dispatch: RideDispatchService,
    private readonly publisher: AblyPublisherService,
    private readonly penalty: PenaltyService,
  ) {}

  /**
   * Create a new ride from the booking payload.
   * If a routeQuoteId is provided, uses the pre-calculated fare from that quote.
   */
  async createRide(passengerId: string, input: CreateRideInput) {
    const {
      pickupAddress,
      pickupMainText,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffMainText,
      dropoffLat,
      dropoffLng,
      vehicleType,
      passengerNote,
      pickupPhotoUrl,
      routeQuoteId,
      fuelPreference,
      petFriendly,
      extraPassengers,
    } = input;

    // ── Security: a valid route quote is REQUIRED ──
    // The backend never accepts fare amounts from the frontend.
    // All pricing comes from a server-persisted RouteQuote record.
    if (!routeQuoteId) {
      throw new BadRequestException(
        'A route quote is required to create a ride.',
      );
    }

    const quote = await this.prisma.routeQuote.findUnique({
      where: { id: routeQuoteId },
    });

    if (!quote) {
      throw new BadRequestException(`RouteQuote not found: ${routeQuoteId}`);
    }

    // ── Quote expiry: reject quotes older than 10 minutes ──
    const QUOTE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
    const quoteAge = Date.now() - quote.createdAt.getTime();
    if (quoteAge > QUOTE_MAX_AGE_MS) {
      throw new BadRequestException(
        'QUOTE_EXPIRED: This price quote has expired. Please refresh the route to get the current price.',
      );
    }

    // ── Prevent quote reuse — a quote can only be used for one ride ──
    if (quote.rideId && quote.rideId !== 'pending') {
      throw new BadRequestException(
        'This quote has already been used for another ride.',
      );
    }

    const distanceMeters = quote.distanceMeters;
    const durationSeconds = quote.durationSeconds;
    const polyline = quote.encodedPolyline;
    const currency = quote.currency;

    // Select fare based on vehicle type — price comes entirely from the DB
    const isPlus = vehicleType === VehicleType.PLUS;
    const totalFare = Number(
      isPlus ? quote.taxiPlusFareMmkt : quote.standardFareMmkt,
    );
    const baseFare = totalFare;
    const distanceFare = 0;
    const timeFare = 0;

    // Link the quote to this ride
    await this.prisma.routeQuote.update({
      where: { id: routeQuoteId },
      data: { rideId: 'pending' }, // Will update with actual rideId below
    });

    const ride = await this.prisma.ride.create({
      data: {
        passengerId,
        vehicleType,
        pickupAddress,
        pickupMainText: pickupMainText ?? null,
        pickupLat,
        pickupLng,
        dropoffAddress,
        dropoffMainText: dropoffMainText ?? null,
        dropoffLat,
        dropoffLng,
        distanceMeters,
        durationSeconds,
        polyline,
        baseFare,
        distanceFare,
        timeFare,
        totalFare,
        currency,
        passengerNote: passengerNote ?? null,
        pickupPhotoUrl: pickupPhotoUrl ?? null,
        fuelPreference: fuelPreference ?? null,
        petFriendly: petFriendly ?? false,
        extraPassengers: extraPassengers ?? false,
      },
    });

    // Update the quote with the actual ride ID
    await this.prisma.routeQuote.update({
      where: { id: routeQuoteId },
      data: { rideId: ride.id },
    });

    this.logger.log(`Ride created: ${ride.id} for passenger ${passengerId}`);

    // Fire-and-forget dispatch to nearby drivers
    void this.dispatch.dispatchRide({
      id: ride.id,
      passengerId,
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      totalFare: Number(ride.totalFare),
      currency: ride.currency,
      vehicleType: ride.vehicleType,
      passengerNote: passengerNote ?? null,
      pickupPhotoUrl: pickupPhotoUrl ?? null,
      vehicleTypePreference: input.vehicleTypePreference ?? null,
      fuelPreference: fuelPreference ?? null,
      petFriendly: petFriendly ?? false,
      extraPassengers: extraPassengers ?? false,
    });

    return {
      id: ride.id,
      status: ride.status,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      totalFare: Number(ride.totalFare),
      currency: ride.currency,
      vehicleType: ride.vehicleType,
      createdAt: ride.createdAt,
    };
  }

  // ──────────────────────────────────────────────────────────
  // Get ride status — lightweight polling endpoint for the rider
  // ──────────────────────────────────────────────────────────

  async getRideStatus(rideId: string, userId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      select: {
        id: true,
        status: true,
        passengerId: true,
        driverId: true,
        driver: {
          select: {
            user: { select: { name: true } },
            currentLocation: {
              select: { latitude: true, longitude: true, heading: true },
            },
          },
        },
      },
    });

    if (!ride) {
      throw new NotFoundException(`Ride not found: ${rideId}`);
    }

    // Only the passenger can poll their own ride status
    if (ride.passengerId !== userId) {
      throw new NotFoundException(`Ride not found: ${rideId}`);
    }

    return {
      id: ride.id,
      status: ride.status,
      driverName: ride.driver?.user?.name ?? null,
      driverLocation: ride.driver?.currentLocation
        ? {
            latitude: Number(ride.driver.currentLocation.latitude),
            longitude: Number(ride.driver.currentLocation.longitude),
            heading: ride.driver.currentLocation.heading
              ? Number(ride.driver.currentLocation.heading)
              : null,
          }
        : null,
    };
  }

  // ──────────────────────────────────────────────────────────
  // Accept ride — race-condition safe via atomic updateMany
  // ──────────────────────────────────────────────────────────

  async acceptRide(rideId: string, driverUserId: string) {
    // 1. Resolve the driver record
    const driver = await this.prisma.driver.findUnique({
      where: { userId: driverUserId },
      select: { id: true, userId: true },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found.');
    }

    // 2. Atomic accept: only succeeds if ride is still PENDING with no driver
    const result = await this.prisma.ride.updateMany({
      where: {
        id: rideId,
        status: 'PENDING',
        driverId: null,
      },
      data: {
        status: 'ACCEPTED',
        driverId: driver.id,
        acceptedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new ConflictException(
        'This ride has already been accepted by another driver.',
      );
    }

    // 3. Set driver status to ON_TRIP
    await this.driverStatus.setStatusByUserId(driverUserId, 'ON_TRIP');

    // 4. Fetch the full ride to return and to notify the rider
    const ride = await this.prisma.ride.findUniqueOrThrow({
      where: { id: rideId },
      include: {
        driver: {
          select: {
            id: true,
            userId: true,
            user: { select: { name: true } },
            currentLocation: {
              select: { latitude: true, longitude: true, heading: true },
            },
          },
        },
      },
    });

    // 5. Notify rider that a driver accepted
    await this.publisher.publish(`rider:${ride.passengerId}`, 'ride_accepted', {
      rideId: ride.id,
      driverId: ride.driverId,
      driverName: ride.driver?.user?.name ?? 'Driver',
      driverLocation: ride.driver?.currentLocation
        ? {
            latitude: Number(ride.driver.currentLocation.latitude),
            longitude: Number(ride.driver.currentLocation.longitude),
            heading: ride.driver.currentLocation.heading
              ? Number(ride.driver.currentLocation.heading)
              : null,
          }
        : null,
    });

    // 6. Cancel the dispatch (clear TTL timer + notify other drivers)
    this.dispatch.cancelDispatch(rideId);

    this.logger.log(
      `Ride ${rideId} accepted by driver ${driver.id} (user ${driverUserId})`,
    );

    return {
      id: ride.id,
      status: ride.status,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      totalFare: Number(ride.totalFare),
      currency: ride.currency,
      vehicleType: ride.vehicleType,
      acceptedAt: ride.acceptedAt,
    };
  }

  // ──────────────────────────────────────────────────────────
  // Acknowledge — driver is now actively viewing this request
  // ──────────────────────────────────────────────────────────

  acknowledgeRide(rideId: string, driverUserId: string) {
    const reset = this.dispatch.resetDriverTimer(rideId, driverUserId);
    return { rideId, timerReset: reset };
  }

  // ──────────────────────────────────────────────────────────
  // Skip ride — driver declines, ride stays PENDING for others
  // ──────────────────────────────────────────────────────────

  async skipRide(rideId: string, driverUserId: string) {
    this.logger.log(`Driver user ${driverUserId} skipped ride ${rideId}`);

    // Mark driver as skipped in active dispatch so they won't be re-notified
    this.dispatch.markDriverSkipped(rideId, driverUserId);

    // Record the rejection for penalty tracking (fire-and-forget)
    void this.penalty.recordRejection(driverUserId);

    // Notify the rider so their map can remove this driver's car icon
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      select: { passengerId: true },
    });

    if (ride) {
      void this.publisher.publish(
        `rider:${ride.passengerId}`,
        'driver_skipped',
        { rideId, driverUserId },
      );
    }

    return { rideId, skipped: true };
  }

  // ──────────────────────────────────────────────────────────
  // Cancel ride — by driver or rider
  // ──────────────────────────────────────────────────────────

  async cancelRide(rideId: string, userId: string, reason?: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      select: {
        id: true,
        status: true,
        passengerId: true,
        driverId: true,
        driver: { select: { userId: true } },
      },
    });

    if (!ride) {
      throw new NotFoundException(`Ride not found: ${rideId}`);
    }

    // Only PENDING or ACCEPTED rides can be cancelled
    if (ride.status !== 'PENDING' && ride.status !== 'ACCEPTED') {
      throw new BadRequestException(
        `Ride cannot be cancelled (current status: ${ride.status})`,
      );
    }

    const isPassenger = ride.passengerId === userId;
    const isDriver = ride.driver?.userId === userId;

    if (!isPassenger && !isDriver) {
      throw new ForbiddenException('You are not part of this ride.');
    }

    const cancellationReason = isDriver ? 'DRIVER_CANCELLED' : 'USER_CANCELLED';

    // Cancel the ride
    await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: 'CANCELLED',
        cancelledBy: userId,
        cancellationReason:
          reason === 'NO_DRIVERS_AVAILABLE'
            ? 'NO_DRIVERS_AVAILABLE'
            : cancellationReason,
        cancelledAt: new Date(),
      },
    });

    // Cancel any active dispatch
    this.dispatch.cancelDispatch(rideId);

    if (isDriver) {
      // Set driver back to ONLINE
      await this.driverStatus.setStatusByUserId(userId, 'ONLINE');

      // Penalise: 5-min silence + rating deduction (fire-and-forget)
      void this.penalty.recordCancellation(userId);

      // Notify rider that the driver cancelled
      await this.publisher.publish(
        `rider:${ride.passengerId}`,
        'ride_cancelled_by_driver',
        { rideId },
      );

      this.logger.log(`Ride ${rideId} cancelled by driver (user ${userId})`);
    } else {
      // Notify driver that the rider cancelled
      if (ride.driver?.userId) {
        await this.driverStatus.setStatusByUserId(ride.driver.userId, 'ONLINE');

        await this.publisher.publish(
          `driver:private:${ride.driver.userId}`,
          'ride_cancelled',
          { rideId },
        );
      }

      this.logger.log(`Ride ${rideId} cancelled by passenger (user ${userId})`);
    }

    return { id: rideId, status: 'CANCELLED' };
  }
}
