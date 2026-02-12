import { Platform } from "react-native";
import axios, { type AxiosError, isAxiosError } from "axios";
import * as SecureStore from "expo-secure-store";
import { signOut } from "@/lib/auth-client";

/**
 * Base URL for the backend API (same host as Better Auth).
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_BETTER_AUTH_URL;
  if (envUrl && envUrl !== "http://localhost:3000") return envUrl;
  if (__DEV__) {
    if (Platform.OS === "android") return "http://10.0.2.2:3000";
    return "http://localhost:3000";
  }
  return envUrl ?? "http://localhost:3000";
}

/** Storage key used by better-auth expo client for cookies (storagePrefix "ftuser"). */
const AUTH_COOKIE_STORAGE_KEY = "ftuser_cookie";

/**
 * Reads the session token from the same storage the better-auth expo client uses.
 * Used to send Authorization: Bearer on API requests. Returns null if not logged in or expired.
 */
export async function getSessionTokenForApi(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_COOKIE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: Record<string, { value?: string; expires?: string | null }> =
      JSON.parse(raw);
    const now = new Date();
    for (const [key, entry] of Object.entries(parsed)) {
      if (!key.includes("session_token") || !entry?.value) continue;
      if (entry.expires && new Date(entry.expires) < now) continue;
      return entry.value;
    }
    return null;
  } catch {
    return null;
  }
}

export interface PlacesSuggestion {
  placeId?: string;
  placeName?: string;
  mainText: string;
  secondaryText?: string;
  description: string;
  /** Meters from user location when nearby bias was used. */
  distanceMeters?: number;
}

interface AutocompleteResponse {
  suggestions: PlacesSuggestion[];
}

/**
 * Axios instance for all non-auth backend API calls.
 * - Request: attaches Authorization: Bearer <session_token> when the user is logged in.
 * - Response: on 401 (e.g. session revoked by admin), calls signOut() so the user is logged out.
 * Use this instance for every call to the API except /api/auth (which uses the auth client).
 */
export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  const token = await getSessionTokenForApi();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      void signOut();
    }
    return Promise.reject(error);
  },
);

/**
 * Fetch place autocomplete suggestions (POI search when location is provided).
 * Pass latitude/longitude to bias results toward nearby places (e.g. "CB bank").
 * Returns all suggestions from the API (no limit; Google typically returns 5–10).
 */
export async function placesAutocomplete(
  search: string,
  sessionToken?: string,
  location?: { latitude: number; longitude: number },
): Promise<PlacesSuggestion[]> {
  const trimmed = search.trim();
  if (!trimmed) return [];

  const body: Record<string, unknown> = { search: trimmed, sessionToken };
  if (
    location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  ) {
    body.latitude = location.latitude;
    body.longitude = location.longitude;
  }

  const { data } = await api.post<AutocompleteResponse>(
    "/maps/autocomplete",
    body,
  );
  return data.suggestions ?? [];
}

// =========================================================================
// Saved Places
// =========================================================================

export interface SavedPlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  icon: string | null;
}

export async function fetchSavedPlaces(): Promise<SavedPlace[]> {
  const { data } = await api.get<{ places: SavedPlace[] }>("/user/saved-places");
  return data.places ?? [];
}

// =========================================================================
// Ride History
// =========================================================================

export interface RideHistoryItem {
  id: string;
  status: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  totalFare: number;
  currency: string;
  completedAt: string | null;
  createdAt: string;
}

export async function fetchRideHistory(
  limit = 10,
): Promise<RideHistoryItem[]> {
  const { data } = await api.get<{ rides: RideHistoryItem[] }>(
    `/user/history?limit=${limit}`,
  );
  return data.rides ?? [];
}

// =========================================================================
// Place Details (resolve placeId → lat/lng)
// =========================================================================

export interface PlaceCoordinates {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

/**
 * Resolve a Google Place ID to lat/lng + address via the backend proxy.
 * Used after autocomplete selection (which only returns placeId, not coords).
 */
export async function fetchPlaceCoordinates(
  placeId: string,
): Promise<PlaceCoordinates> {
  const { data } = await api.post<PlaceCoordinates>("/maps/place-details", {
    placeId,
  });
  return data;
}

// =========================================================================
// Reverse Geocode
// =========================================================================

export interface ReverseGeocodeResult {
  address: string | null;
  placeId: string | null;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult> {
  const { data } = await api.post<ReverseGeocodeResult>(
    "/maps/reverse-geocode",
    { latitude, longitude },
  );
  return data;
}

// =========================================================================
// Route Quote
// =========================================================================

export interface RouteQuotePayload {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  /** Intermediate stops between pickup and final dropoff. */
  waypoints?: { lat: number; lng: number }[];
  originTownship?: string;
  destinationTownship?: string;
}

export interface SpeedReadingInterval {
  startPolylinePointIndex: number;
  endPolylinePointIndex: number;
  speed: "NORMAL" | "SLOW" | "TRAFFIC_JAM";
}

export interface RouteQuoteResult {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  encodedPolyline: string;
  speedReadingIntervals: SpeedReadingInterval[];
  standardFareMmkt: number;
  plusFareMmkt: number;
  currency: string;
  routeQuoteId: string;
}

/**
 * Fetch a route quote from the backend (Google Routes API proxy + fare calc).
 * Returns polyline, distance, duration, and fares for Standard & Plus.
 */
export async function fetchRouteQuote(
  payload: RouteQuotePayload,
): Promise<RouteQuoteResult> {
  const { data } = await api.post<RouteQuoteResult>("/maps/route", payload);
  return data;
}

// =========================================================================
// Rides — Pickup Photo Upload
// =========================================================================

/**
 * Upload a pickup location photo. Returns the Vercel Blob URL.
 * The image is optimized server-side to 800x600 WebP.
 */
export async function uploadPickupPhoto(uri: string): Promise<string> {
  const formData = new FormData();

  // Determine file name and mime type from the URI
  const filename = uri.split("/").pop() ?? "pickup.jpg";
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeType =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : "image/jpeg";

  formData.append("file", {
    uri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);

  const { data } = await api.post<{ url: string }>(
    "/rides/upload-photo",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30_000,
    },
  );

  return data.url;
}

// =========================================================================
// Rides — Create Ride
// =========================================================================

export interface CreateRidePayload {
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType?: string;
  passengerNote?: string;
  pickupPhotoUrl?: string;
  routeQuoteId?: string;
}

export interface CreateRideResponse {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  totalFare: number;
  currency: string;
  vehicleType: string;
  createdAt: string;
}

/**
 * Create a new ride from the full booking payload.
 */
export async function createRide(
  payload: CreateRidePayload,
): Promise<CreateRideResponse> {
  const { data } = await api.post<CreateRideResponse>("/rides", payload);
  return data;
}

// =========================================================================
// Nearby Drivers
// =========================================================================

export interface NearbyDriver {
  driverId: string;
  userId: string;
  driverName: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  distanceMeters: number;
}

/**
 * Fetch nearby online drivers around a pickup point.
 * Used to render car markers on the map while searching for a driver.
 */
export async function fetchNearbyDrivers(
  lat: number,
  lng: number,
  radius = 30000,
  limit = 20,
): Promise<NearbyDriver[]> {
  const { data } = await api.get<{ count: number; drivers: NearbyDriver[] }>(
    `/dispatch/nearby`,
    { params: { lat, lng, radius, limit } },
  );
  return data.drivers;
}

// =========================================================================
// Ride Status Polling
// =========================================================================

export interface RideStatusResult {
  id: string;
  status: string;
  driverName: string | null;
  driverLocation: {
    latitude: number;
    longitude: number;
    heading: number | null;
  } | null;
}

/**
 * Poll the current status of a ride. Used as a fallback when Ably
 * messages might be missed (e.g., due to late subscription).
 */
export async function fetchRideStatus(
  rideId: string,
): Promise<RideStatusResult> {
  const { data } = await api.get<RideStatusResult>(`/rides/${rideId}/status`);
  return data;
}

// =========================================================================
// Helpers
// =========================================================================

/** Helper to read error message from axios or unknown. */
export function getErrorMessage(err: unknown): string {
  const ax = err as AxiosError<{ message?: string }>;
  if (isAxiosError(ax)) {
    const msg = ax.response?.data?.message ?? ax.message;
    const status = ax.response?.status;
    return status ? `Request failed (${status}): ${msg}` : String(msg);
  }
  return err instanceof Error ? err.message : "Request failed";
}

// =========================================================================
// Ride Cancel
// =========================================================================

/**
 * Cancel a ride (rider-initiated). Called when the rider cancels during search.
 */
export async function cancelRide(rideId: string): Promise<void> {
  await api.post(`/rides/${rideId}/cancel`, { reason: 'USER_CANCELLED' });
}

// =========================================================================
// User Login Validation
// =========================================================================

/**
 * Validate whether an email is eligible for rider login / password reset.
 * Call this BEFORE sign-in or forgot-password to give clear error messages
 * (e.g. "This account is a driver — use the driver app").
 *
 * Throws (via axios) with a descriptive `message` if the email is not eligible.
 */
export async function validateUserLogin(email: string): Promise<void> {
  await api.post("/user/validate-login", {
    email: email.trim().toLowerCase(),
  });
}
