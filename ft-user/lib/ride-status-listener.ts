import type Ably from "ably";
import { getAblyClient } from "./ably";
import { fetchRideStatus } from "./api";
import { useRideBookingStore } from "@/store/ride-booking";

/**
 * Per-booking Ably subscription for the rider.
 *
 * When a ride is created, the rider subscribes to `rider:<userId>`.
 * The backend publishes `ride_accepted`, `no_driver_found`, and
 * `ride_cancelled_by_driver` here.
 *
 * A REST polling fallback runs every 5s to catch messages that were
 * published before the Ably client finished subscribing.
 */

let subscribedChannel: Ably.RealtimeChannel | null = null;
let pollingTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Connect the Ably client (if needed) and subscribe to the rider's channel.
 * Should be called BEFORE `createRide()` so we don't miss instant responses.
 *
 * If Ably fails (e.g. timeout), we continue silently — the REST polling
 * fallback will still catch events. The rider never sees a raw error.
 */
export async function startListening(userId: string): Promise<void> {
  // ── Defensive cleanup of any previous subscription ──
  if (subscribedChannel) {
    try {
      subscribedChannel.unsubscribe();
      if (subscribedChannel.state === "attached") {
        await subscribedChannel.detach();
      }
    } catch {
      // Swallow — old channel might already be detached
    }
    subscribedChannel = null;
  }

  const client = getAblyClient(userId);

  // Connect if not already connected
  try {
    if (
      client.connection.state !== "connected" &&
      client.connection.state !== "connecting"
    ) {
      client.connect();
    }

    if (client.connection.state !== "connected") {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          resolve(); // Don't reject — fall back to polling
        }, 10_000);

        const onConnected = () => {
          clearTimeout(timeout);
          cleanup();
          resolve();
        };
        const onFailed = (stateChange: Ably.ConnectionStateChange) => {
          clearTimeout(timeout);
          cleanup();
          reject(stateChange.reason ?? new Error("Ably connection failed"));
        };
        const cleanup = () => {
          client.connection.off("connected", onConnected);
          client.connection.off("failed", onFailed);
        };
        client.connection.once("connected", onConnected);
        client.connection.once("failed", onFailed);
      });
    }
  } catch {
    // Connection failed — continue without Ably; polling fallback handles it
    return;
  }

  // If still not connected (timeout resolved without error), skip channel attach
  if (client.connection.state !== "connected") return;

  const channelName = `rider:${userId}`;
  const channel = client.channels.get(channelName);

  try {
    await channel.attach();
  } catch {
    // Channel attach failed (e.g. timeout) — continue silently
    // The REST polling fallback will catch events
    return;
  }

  // ── ride_accepted ──
  channel.subscribe("ride_accepted", (message: Ably.Message) => {
    const data = message.data as {
      rideId: string;
      driverId: string;
      driverName: string;
      driverLocation: {
        latitude: number;
        longitude: number;
        heading: number | null;
      } | null;
    } | undefined;

    if (!data?.rideId) return;

    const store = useRideBookingStore.getState();
    if (store.activeRideId && store.activeRideId !== data.rideId) return;

    store.setBookingAccepted({
      driverName: data.driverName,
      driverLocation: data.driverLocation,
    });

    stopPolling();
  });

  // ── no_driver_found ──
  channel.subscribe("no_driver_found", (message: Ably.Message) => {
    const data = message.data as { rideId: string } | undefined;
    if (!data?.rideId) return;

    const store = useRideBookingStore.getState();
    if (store.activeRideId && store.activeRideId !== data.rideId) return;

    store.setBookingNoDriver();
    stopPolling();
  });

  // ── driver_skipped ──
  channel.subscribe("driver_skipped", (message: Ably.Message) => {
    const data = message.data as { rideId: string; driverUserId: string } | undefined;
    if (!data?.rideId || !data.driverUserId) return;

    const store = useRideBookingStore.getState();
    if (store.activeRideId && store.activeRideId !== data.rideId) return;

    store.addSkippedDriver(data.driverUserId);
  });

  // ── dispatch_progress (sequential waterfall — current driver being contacted) ──
  channel.subscribe("dispatch_progress", (message: Ably.Message) => {
    const data = message.data as
      | {
          rideId: string;
          driverName: string;
        }
      | undefined;

    if (!data?.rideId) return;

    const store = useRideBookingStore.getState();
    if (store.activeRideId && store.activeRideId !== data.rideId) return;

    store.setCurrentDispatchDriver({
      driverName: data.driverName,
    });
  });

  // ── dispatch_waiting (all rounds exhausted, retrying — clear stale driver name) ──
  channel.subscribe("dispatch_waiting", (message: Ably.Message) => {
    const data = message.data as { rideId: string } | undefined;
    if (!data?.rideId) return;

    const store = useRideBookingStore.getState();
    if (store.activeRideId && store.activeRideId !== data.rideId) return;

    store.clearCurrentDispatchDriver();
  });

  // ── ride_cancelled_by_driver ──
  channel.subscribe("ride_cancelled_by_driver", (message: Ably.Message) => {
    const data = message.data as { rideId: string } | undefined;
    if (!data?.rideId) return;

    const store = useRideBookingStore.getState();
    if (store.activeRideId && store.activeRideId !== data.rideId) return;

    store.setBookingDriverCancelled();
    stopPolling();
  });

  subscribedChannel = channel;
}

/**
 * Start polling the ride status via REST as a fallback.
 * Should be called AFTER `createRide()` returns with the ride ID.
 * Polls every 5 seconds, resolves missed Ably messages.
 */
export function startPolling(rideId: string): void {
  stopPolling();

  pollingTimer = setInterval(() => {
    void pollRideStatus(rideId);
  }, 5_000);
}

async function pollRideStatus(rideId: string): Promise<void> {
  const store = useRideBookingStore.getState();
  // If booking is no longer in "searching" or "accepted" state, stop polling
  if (
    store.bookingStatus !== "searching" &&
    store.bookingStatus !== "accepted"
  ) {
    stopPolling();
    return;
  }

  try {
    const result = await fetchRideStatus(rideId);

    if (result.status === "ACCEPTED" && store.bookingStatus === "searching") {
      store.setBookingAccepted({
        driverName: result.driverName ?? "Driver",
        driverLocation: result.driverLocation,
      });
      stopPolling();
    } else if (result.status === "CANCELLED") {
      // Could be system cancel (no driver) or driver cancel
      if (store.bookingStatus === "accepted") {
        store.setBookingDriverCancelled();
      } else {
        store.setBookingNoDriver();
      }
      stopPolling();
    }
  } catch {
    // Network error — keep polling, don't crash
  }
}

function stopPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

/**
 * Unsubscribe from the rider channel, stop polling, and detach.
 * Called after booking completes, is cancelled, or user navigates away.
 */
export async function stopListening(): Promise<void> {
  stopPolling();

  if (!subscribedChannel) return;

  try {
    subscribedChannel.unsubscribe();
    if (subscribedChannel.state === "attached") {
      await subscribedChannel.detach();
    }
  } catch {
    // Swallow — channel might already be detached
  }

  subscribedChannel = null;
}
