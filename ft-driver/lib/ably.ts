import Ably from "ably";

const ABLY_KEY = process.env.EXPO_PUBLIC_ABLY_API_KEY ?? "";
const CHANNEL_NAME = "drivers:available";

// ── Singleton Ably client ──────────────────────────────────
let ablyClient: Ably.Realtime | null = null;
let currentClientId: string | null = null;

/**
 * Return (or lazily create) an Ably Realtime client bound to this userId.
 * If the userId changes (e.g. sign-out → sign-in as different user),
 * the old client is closed and a new one is created.
 */
export function getAblyClient(userId: string): Ably.Realtime {
  if (ablyClient && currentClientId === userId) return ablyClient;

  // Tear down stale client for a different user
  if (ablyClient) {
    ablyClient.close();
    ablyClient = null;
  }

  ablyClient = new Ably.Realtime({
    key: ABLY_KEY,
    clientId: userId,
    autoConnect: false, // We connect manually when driver goes online
  });
  currentClientId = userId;
  return ablyClient;
}

/**
 * Fully close the Ably connection and reset state.
 * Call on sign-out.
 */
export function closeAblyClient(): void {
  if (ablyClient) {
    ablyClient.close();
    ablyClient = null;
    currentClientId = null;
  }
}

// ── Presence helpers ───────────────────────────────────────

/**
 * Attach to the drivers channel and enter presence.
 * The backend webhook will set the driver ONLINE.
 */
export async function enterPresence(userId: string): Promise<void> {
  const client = getAblyClient(userId);

  // Connect if not already connected
  if (client.connection.state !== "connected") {
    client.connect();
    await new Promise<void>((resolve, reject) => {
      const onConnected = () => {
        cleanup();
        resolve();
      };
      const onFailed = (stateChange: Ably.ConnectionStateChange) => {
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

  const channel = client.channels.get(CHANNEL_NAME);
  await channel.attach();
  await channel.presence.enter();
}

/**
 * Leave presence and detach from the channel.
 * The backend webhook will set the driver OFFLINE.
 */
export async function leavePresence(): Promise<void> {
  if (!ablyClient) return;

  try {
    const channel = ablyClient.channels.get(CHANNEL_NAME);
    if (channel.state === "attached") {
      await channel.presence.leave();
      await channel.detach();
    }
  } catch {
    // Swallow errors during leave — the server will time-out presence anyway
  }
}

// ── Ride tracking channel helpers ─────────────────────────

/**
 * Publish a location update to the ride-specific tracking channel.
 * Used for high-frequency (2s) updates during an active ride so the
 * rider can see the driver moving in real-time.
 */
export function publishRideLocation(
  rideId: string,
  data: {
    lat: number;
    lng: number;
    heading: number | null;
    speed: number | null;
    timestamp: number;
  },
): void {
  if (!ablyClient || ablyClient.connection.state !== "connected") return;

  const channel = ablyClient.channels.get(`ride:tracking:${rideId}`);
  // Fire-and-forget — don't await; high-frequency publishes should not block
  void channel.publish("location", data);
}

/**
 * Detach from a ride tracking channel when the ride ends.
 */
export async function detachRideChannel(rideId: string): Promise<void> {
  if (!ablyClient) return;

  try {
    const channel = ablyClient.channels.get(`ride:tracking:${rideId}`);
    if (channel.state === "attached") {
      await channel.detach();
    }
  } catch {
    // Non-critical — channel will be garbage-collected
  }
}
