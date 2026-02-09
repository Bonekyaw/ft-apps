import { Platform } from "react-native";
import axios, { type AxiosError, isAxiosError } from "axios";

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

/** Axios instance for the backend API (no auth attached). */
export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

/**
 * Fetch place autocomplete suggestions (POI search when location is provided).
 * Pass latitude/longitude to bias results toward nearby places (e.g. "CB bank").
 * Returns all suggestions from the API (no limit; Google typically returns 5–10).
 */
export async function placesAutocomplete(
  search: string,
  sessionToken?: string,
  location?: { latitude: number; longitude: number }
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

  const { data } = await api.post<AutocompleteResponse>("/maps/autocomplete", body);
  return data.suggestions ?? [];
}

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
