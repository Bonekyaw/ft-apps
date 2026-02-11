import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

const PLACES_AUTOCOMPLETE_URL =
  'https://places.googleapis.com/v1/places:autocomplete';

/** Routes API (Compute Routes – Basic SKU). Only request essentials to keep cost low. */
const ROUTES_COMPUTE_URL =
  'https://routes.googleapis.com/directions/v2:computeRoutes';

const ROUTES_FIELD_MASK =
  'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline';

export interface AutocompleteRequestBody {
  search: string;
  sessionToken?: string;
  latitude?: number;
  longitude?: number;
}

interface GooglePlacePrediction {
  placePrediction?: {
    place: string;
    placeId: string;
    text?: { text: string };
    structuredFormat?: {
      mainText?: { text: string };
      secondaryText?: { text: string };
    };
    distanceMeters?: number;
  };
  queryPrediction?: {
    text?: { text: string };
    structuredFormat?: {
      mainText?: { text: string };
      secondaryText?: { text: string };
    };
  };
}

interface GoogleAutocompleteResponse {
  suggestions?: GooglePlacePrediction[];
}

export interface AutocompleteSuggestion {
  placeId?: string;
  placeName?: string;
  mainText: string;
  secondaryText?: string;
  description: string;
  distanceMeters?: number;
}

@Injectable()
export class MapsService {
  constructor(private readonly config: ConfigService) {}

  private getApiKey(): string {
    const key =
      this.config.get<string>('GOOGLE_PLACES_API_KEY') ??
      this.config.get<string>('GOOGLE_MAPS_API_KEY') ??
      this.config.get<string>('GOOGLE_ROUTES_API_KEY');
    if (!key) {
      throw new Error(
        'GOOGLE_PLACES_API_KEY, GOOGLE_MAPS_API_KEY, or GOOGLE_ROUTES_API_KEY must be set in .env',
      );
    }
    return key;
  }

  /**
   * Compute route between two points using Google Routes API (Basic SKU).
   * Only requests duration, distanceMeters, and polyline.encodedPolyline.
   * Returns distance in KM and duration in Minutes.
   */
  async computeRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<{
    distanceKm: number;
    durationMinutes: number;
    distanceMeters: number;
    durationSeconds: number;
    encodedPolyline: string;
  }> {
    const apiKey = this.getApiKey();

    const body = {
      origin: {
        location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
      },
      destination: {
        location: {
          latLng: { latitude: destination.lat, longitude: destination.lng },
        },
      },
      travelMode: 'DRIVE',
      computeAlternativeRoutes: false,
      languageCode: 'en-US',
      units: 'METRIC',
    };

    const { data } = await axios.post<{
      routes?: Array<{
        distanceMeters?: number;
        duration?: string;
        polyline?: { encodedPolyline?: string };
      }>;
    }>(ROUTES_COMPUTE_URL, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': ROUTES_FIELD_MASK,
      },
      timeout: 15_000,
    });

    const route = data.routes?.[0];
    if (!route) {
      throw new Error('No route returned from Routes API');
    }

    const distanceMeters = route.distanceMeters ?? 0;
    const encodedPolyline = route.polyline?.encodedPolyline ?? '';

    let durationSeconds = 0;
    if (typeof route.duration === 'string') {
      const match = route.duration.match(/^(\d+)s$/);
      durationSeconds = match ? parseInt(match[1], 10) : 0;
    }

    // Convert to KM and Minutes
    const distanceKm = distanceMeters / 1000;
    const durationMinutes = durationSeconds / 60;

    return {
      distanceKm,
      durationMinutes,
      distanceMeters,
      durationSeconds,
      encodedPolyline,
    };
  }

  /** Small radius for very nearby results (5 km). */
  private static readonly NEAR_RADIUS_M = 5_000;
  /** Large radius for broader nearby results (50 km, API max). */
  private static readonly WIDE_RADIUS_M = 50_000;

  /** Myanmar bounding box for when user has no location. */
  private static readonly MYANMAR_BOUNDS = {
    rectangle: {
      low: { latitude: 9.2, longitude: 92.0 },
      high: { latitude: 28.6, longitude: 101.4 },
    },
  } as const;

  async autocomplete(
    body: AutocompleteRequestBody,
  ): Promise<AutocompleteSuggestion[]> {
    const { search, sessionToken, latitude, longitude } = body;
    const trimmed = search?.trim() ?? '';
    if (!trimmed) {
      return [];
    }

    const hasLocation =
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude);

    if (hasLocation) {
      // Make two parallel calls with different radii to get ~10 results.
      // Call 1: small radius (5 km) → nearest branches
      // Call 2: wide radius (200 km) → broader area results
      const loc = { latitude, longitude };
      const [nearResults, wideResults] = await Promise.all([
        this.callAutocomplete(trimmed, sessionToken, {
          ...loc,
          radius: MapsService.NEAR_RADIUS_M,
        }),
        this.callAutocomplete(trimmed, sessionToken, {
          ...loc,
          radius: MapsService.WIDE_RADIUS_M,
        }),
      ]);

      // Merge, deduplicate by placeId, sort by distance (nearest first).
      return this.mergeAndDeduplicate(nearResults, wideResults);
    }

    // No location: single call restricted to Myanmar.
    return this.callAutocomplete(trimmed, sessionToken, null);
  }

  // ---------------------------------------------------------------------------
  // Core Autocomplete call
  // ---------------------------------------------------------------------------

  private async callAutocomplete(
    input: string,
    sessionToken: string | undefined,
    location: { latitude: number; longitude: number; radius: number } | null,
  ): Promise<AutocompleteSuggestion[]> {
    const apiKey = this.getApiKey();

    const requestBody: Record<string, unknown> = {
      input,
      includedRegionCodes: ['MM'],
      regionCode: 'MM',
      includeQueryPredictions: false,
    };

    if (sessionToken) {
      requestBody.sessionToken = sessionToken;
    }

    if (location) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          radius: location.radius,
        },
      };
      requestBody.origin = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
    } else {
      requestBody.locationRestriction = MapsService.MYANMAR_BOUNDS;
    }

    try {
      const { data } = await axios.post<GoogleAutocompleteResponse>(
        PLACES_AUTOCOMPLETE_URL,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
          },
          timeout: 10_000,
        },
      );

      return this.normalizeSuggestions(data);
    } catch (err) {
      const axiosError = err as AxiosError<{ error?: { message?: string } }>;
      if (axios.isAxiosError(axiosError)) {
        const status = axiosError.response?.status;
        const message = axiosError.response?.data?.error?.message;
        throw new Error(
          `Places autocomplete failed (${status ?? 'network'}): ${message}`,
        );
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private normalizeSuggestions(
    response: GoogleAutocompleteResponse,
  ): AutocompleteSuggestion[] {
    const suggestions = response.suggestions ?? [];
    return suggestions
      .map((s): AutocompleteSuggestion | null => {
        if (s.placePrediction) {
          const p = s.placePrediction;
          const main = p.structuredFormat?.mainText?.text ?? p.text?.text ?? '';
          const secondary = p.structuredFormat?.secondaryText?.text ?? '';
          return {
            placeId: p.placeId,
            placeName: p.place,
            mainText: main,
            secondaryText: secondary || undefined,
            description: secondary ? `${main}, ${secondary}` : main,
            distanceMeters: p.distanceMeters,
          };
        }
        return null;
      })
      .filter((s): s is AutocompleteSuggestion => s !== null);
  }

  /**
   * Merge two result sets, deduplicate by placeId, and sort by distance.
   * Near results come first (lower distance), then wide results fill up to ~10.
   */
  private mergeAndDeduplicate(
    nearResults: AutocompleteSuggestion[],
    wideResults: AutocompleteSuggestion[],
  ): AutocompleteSuggestion[] {
    const seen = new Set<string>();
    const merged: AutocompleteSuggestion[] = [];

    // Add all near results first (they are the closest).
    for (const item of nearResults) {
      const key = item.placeId ?? item.description;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    // Add wide results that aren't already included.
    for (const item of wideResults) {
      const key = item.placeId ?? item.description;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    // Sort by distance (nearest first); items without distance go last.
    merged.sort(
      (a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
    );

    return merged;
  }
}
