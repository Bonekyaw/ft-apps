import type Ably from "ably";
import { getAblyClient } from "./ably";
import { useRideStore, type IncomingRideRequest } from "./ride-store";

/**
 * Private Ably channel listener for ride dispatch events.
 *
 * When the driver is online, subscribes to `driver:private:<userId>`.
 * The backend publishes `new_ride_request` and `ride_cancelled` events here.
 */

let subscribedChannel: Ably.RealtimeChannel | null = null;
let subscribedUserId: string | null = null;

/**
 * Subscribe to the driver's private channel for incoming ride requests.
 * Always performs a full clean-up → connect → attach → subscribe cycle
 * to guarantee a fresh, working subscription after offline/online toggles.
 */
export async function subscribeToPrivateChannel(
  userId: string,
): Promise<void> {
  // Always start clean — avoids stale channel/subscription state
  await unsubscribeFromPrivateChannel();

  const client = getAblyClient(userId);
  const channelName = `driver:private:${userId}`;

  // ── 1. Ensure the Ably connection is alive ──
  if (client.connection.state !== "connected") {
    console.log(
      `[RideListener] Connection state is "${client.connection.state}", reconnecting…`,
    );
    client.connect();
    await new Promise<void>((resolve, reject) => {
      const onConnected = () => {
        cleanup();
        resolve();
      };
      const onFailed = (sc: Ably.ConnectionStateChange) => {
        cleanup();
        reject(sc.reason ?? new Error("Ably connection failed"));
      };
      const cleanup = () => {
        client.connection.off("connected", onConnected);
        client.connection.off("failed", onFailed);
      };
      client.connection.once("connected", onConnected);
      client.connection.once("failed", onFailed);
    });
  }

  console.log(
    `[RideListener] Connection OK (state=${client.connection.state}). Attaching ${channelName}…`,
  );

  // ── 2. Get a fresh channel and attach ──
  const channel = client.channels.get(channelName);
  await channel.attach();

  console.log(
    `[RideListener] Channel attached (state=${channel.state}). Adding subscriptions…`,
  );

  // ── 3. Subscribe to incoming ride requests ──
  channel.subscribe("new_ride_request", (message: Ably.Message) => {
    console.log(
      "[RideListener] new_ride_request received:",
      JSON.stringify(message.data),
    );

    const data = message.data as IncomingRideRequest | undefined;
    if (!data?.rideId) {
      console.log("[RideListener] Ignored — payload missing rideId");
      return;
    }

    // Enqueue: shows immediately if no request is active, otherwise queues it
    console.log(`[RideListener] Enqueuing ride ${data.rideId}`);
    useRideStore.getState().enqueueRequest(data);
  });

  // ── 4. Subscribe to ride cancelled (another driver accepted or TTL expired) ──
  channel.subscribe("ride_cancelled", (message: Ably.Message) => {
    console.log(
      "[RideListener] ride_cancelled received:",
      JSON.stringify(message.data),
    );

    const data = message.data as { rideId: string } | undefined;
    if (!data?.rideId) return;

    // Removes from the current display or the queue
    useRideStore.getState().removeRequest(data.rideId);
  });

  subscribedChannel = channel;
  subscribedUserId = userId;

  console.log(`[RideListener] ✅ Fully subscribed to ${channelName}`);
}

/**
 * Unsubscribe from the driver's private channel.
 * Called when going offline or signing out.
 */
export async function unsubscribeFromPrivateChannel(): Promise<void> {
  if (!subscribedChannel) return;

  const channelName = subscribedChannel.name;
  console.log(`[RideListener] Unsubscribing from ${channelName}…`);

  try {
    subscribedChannel.unsubscribe();
    if (subscribedChannel.state === "attached") {
      await subscribedChannel.detach();
    }
  } catch {
    // Swallow — channel might already be detached
  }

  subscribedChannel = null;
  subscribedUserId = null;

  console.log(`[RideListener] Unsubscribed from ${channelName}`);
}
