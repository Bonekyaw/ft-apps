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
 * Safe to call multiple times — will skip if already subscribed for this user.
 */
export async function subscribeToPrivateChannel(
  userId: string,
): Promise<void> {
  // Already subscribed for this user
  if (subscribedChannel && subscribedUserId === userId) return;

  // Clean up stale subscription for a different user
  if (subscribedChannel) {
    await unsubscribeFromPrivateChannel();
  }

  const client = getAblyClient(userId);
  const channelName = `driver:private:${userId}`;
  const channel = client.channels.get(channelName);

  await channel.attach();

  // Listen for incoming ride requests
  channel.subscribe("new_ride_request", (message: Ably.Message) => {
    const data = message.data as IncomingRideRequest | undefined;
    if (!data?.rideId) return;

    const { incomingRequest } = useRideStore.getState();
    // Don't overwrite an existing request (driver might be reviewing one)
    if (incomingRequest) return;

    useRideStore.getState().setIncomingRequest(data);
  });

  // Listen for ride cancelled (another driver accepted or TTL expired)
  channel.subscribe("ride_cancelled", (message: Ably.Message) => {
    const data = message.data as { rideId: string } | undefined;
    if (!data?.rideId) return;

    const { incomingRequest } = useRideStore.getState();
    if (incomingRequest?.rideId === data.rideId) {
      useRideStore.getState().clearIncomingRequest();
    }
  });

  subscribedChannel = channel;
  subscribedUserId = userId;
}

/**
 * Unsubscribe from the driver's private channel.
 * Called when going offline or signing out.
 */
export async function unsubscribeFromPrivateChannel(): Promise<void> {
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
  subscribedUserId = null;
}
