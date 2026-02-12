import Ably from "ably";

const ABLY_KEY = process.env.EXPO_PUBLIC_ABLY_API_KEY ?? "";

// ── Singleton Ably client ──────────────────────────────────
let ablyClient: Ably.Realtime | null = null;
let currentClientId: string | null = null;

/**
 * Return (or lazily create) an Ably Realtime client for the given userId.
 * Riders only need subscribe capability — no presence.
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
    autoConnect: false,
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
