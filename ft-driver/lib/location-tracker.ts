import * as Location from "expo-location";
import { publishRideLocation, detachRideChannel } from "./ably";
import { updateDriverLocation } from "./api";
import { useRideStore } from "./ride-store";

// ── Configuration ──────────────────────────────────────────
const ABLY_THROTTLE_MS = 2_000; // 2 seconds — high-frequency ride tracking
const REST_THROTTLE_MS = 30_000; // 30 seconds — low-frequency persistence
const REST_DISTANCE_M = 50; // 50 meters — distance-based persistence trigger

// ── Location listener system (for UI to react to GPS without extra subs) ──
export interface DriverCoords {
  latitude: number;
  longitude: number;
  heading: number | null;
}
type LocationCallback = (coords: DriverCoords) => void;
const locationListeners = new Set<LocationCallback>();

/** Subscribe to live GPS coordinates. Returns an unsubscribe function. */
export function addLocationListener(cb: LocationCallback): () => void {
  locationListeners.add(cb);
  return () => {
    locationListeners.delete(cb);
  };
}

// ── Module state (singleton — persists across screen navigation) ─────
let locationSub: Location.LocationSubscription | null = null;
let lastAblyPublishTs = 0;
let lastRestCallTs = 0;
let lastRestLat = 0;
let lastRestLng = 0;
let currentRideId: string | null = null;

// ── Haversine distance (meters) ────────────────────────────
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Internal: dispatch a GPS update ────────────────────────
function handleLocationUpdate(coords: Location.LocationObjectCoords): void {
  const now = Date.now();
  const { latitude, longitude, heading, speed, accuracy } = coords;

  // ── Notify UI listeners (zero-copy, no state overhead) ──
  if (locationListeners.size > 0) {
    const payload: DriverCoords = {
      latitude,
      longitude,
      heading: heading ?? null,
    };
    for (const cb of locationListeners) cb(payload);
  }

  // ── High-frequency: publish to Ably ride channel (every 2s) ──
  const rideId = currentRideId ?? useRideStore.getState().activeRideId;
  if (rideId && now - lastAblyPublishTs >= ABLY_THROTTLE_MS) {
    publishRideLocation(rideId, {
      lat: latitude,
      lng: longitude,
      heading: heading ?? null,
      speed: speed != null ? speed * 3.6 : null, // m/s → km/h
      timestamp: now,
    });
    lastAblyPublishTs = now;
  }

  // ── Low-frequency: persist to backend via REST (every 30s or 50m) ──
  const timeSinceLastRest = now - lastRestCallTs;
  const distanceMoved =
    lastRestLat === 0 && lastRestLng === 0
      ? Infinity // First update — always send
      : haversineMeters(lastRestLat, lastRestLng, latitude, longitude);

  if (
    timeSinceLastRest >= REST_THROTTLE_MS ||
    distanceMoved >= REST_DISTANCE_M
  ) {
    void updateDriverLocation({
      latitude,
      longitude,
      heading: heading ?? undefined,
      speed: speed != null ? speed * 3.6 : undefined, // m/s → km/h
      accuracy: accuracy ?? undefined,
    });
    lastRestCallTs = now;
    lastRestLat = latitude;
    lastRestLng = longitude;
  }
}

// ── Public API ─────────────────────────────────────────────

/**
 * Start continuous GPS tracking. Call when the driver goes ONLINE.
 * Idempotent — calling while already tracking is a no-op.
 */
export async function startTracking(): Promise<void> {
  if (locationSub) return; // Already tracking

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return;

  locationSub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 5, // Minimum 5m between updates (saves battery)
      timeInterval: 1_000, // At most once per second
    },
    (location) => handleLocationUpdate(location.coords),
  );
}

/**
 * Stop all GPS tracking. Call when the driver goes OFFLINE.
 * Also detaches from any active ride channel.
 */
export async function stopTracking(): Promise<void> {
  if (locationSub) {
    locationSub.remove();
    locationSub = null;
  }

  // Detach from ride channel if one was active
  if (currentRideId) {
    await detachRideChannel(currentRideId);
    currentRideId = null;
  }

  // Reset throttle state
  lastAblyPublishTs = 0;
  lastRestCallTs = 0;
  lastRestLat = 0;
  lastRestLng = 0;
}

/**
 * Set or clear the active ride. When a ride is active, high-frequency
 * Ably publishing kicks in (every 2s).
 */
export async function setActiveRide(rideId: string | null): Promise<void> {
  // Detach from old ride channel if switching
  if (currentRideId && currentRideId !== rideId) {
    await detachRideChannel(currentRideId);
  }
  currentRideId = rideId;
  lastAblyPublishTs = 0; // Reset so next update publishes immediately
}
