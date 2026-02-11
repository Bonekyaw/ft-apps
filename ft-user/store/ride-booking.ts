import { create } from "zustand";
import type { SpeedReadingInterval } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StopLocation {
  address: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  /** Short display name (e.g. "Sule Pagoda") */
  mainText?: string;
}

export type VehicleFilter = "ANY" | "STANDARD" | "PLUS";
export type FuelFilter = "ANY" | "CNG" | "PETROL";

export const MAX_STOPS = 4;

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface RideBookingState {
  /** Ordered destination stops (1–4). null = not yet selected. */
  stops: (StopLocation | null)[];

  /** Which stop index is currently being edited (-1 = none) */
  activeStopIndex: number;

  // Filters
  vehicleType: VehicleFilter;
  petFriendly: boolean;
  fuelPreference: FuelFilter;

  // Pickup
  pickup: StopLocation | null;
  pickupNote: string;
  pickupPhotoUri: string | null;

  // Route quote
  routeQuoteId: string | null;
  encodedPolyline: string | null;
  speedReadingIntervals: SpeedReadingInterval[] | null;
  standardFare: number | null;
  plusFare: number | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  currency: string;

  // Actions — stops
  setStop: (index: number, location: StopLocation | null) => void;
  addStop: () => boolean;
  removeStop: (index: number) => void;
  setActiveStopIndex: (index: number) => void;

  // Actions — filters
  setVehicleType: (type: VehicleFilter) => void;
  togglePetFriendly: () => void;
  setFuelPreference: (pref: FuelFilter) => void;

  // Actions — pickup
  setPickup: (location: StopLocation | null) => void;
  setPickupNote: (note: string) => void;
  setPickupPhotoUri: (uri: string | null) => void;

  // Actions — route quote
  setRouteQuote: (data: {
    routeQuoteId: string;
    encodedPolyline: string;
    speedReadingIntervals: SpeedReadingInterval[];
    standardFare: number;
    plusFare: number;
    distanceKm: number;
    durationMinutes: number;
    currency: string;
  }) => void;

  // Clear only route quote data (used when going back from book-taxi)
  clearRouteQuote: () => void;

  // Reset everything
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE = {
  stops: [null] as (StopLocation | null)[],
  activeStopIndex: 0,
  vehicleType: "ANY" as VehicleFilter,
  petFriendly: false,
  fuelPreference: "ANY" as FuelFilter,
  pickup: null as StopLocation | null,
  pickupNote: "",
  pickupPhotoUri: null as string | null,
  routeQuoteId: null as string | null,
  encodedPolyline: null as string | null,
  speedReadingIntervals: null as SpeedReadingInterval[] | null,
  standardFare: null as number | null,
  plusFare: null as number | null,
  distanceKm: null as number | null,
  durationMinutes: null as number | null,
  currency: "MMK",
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRideBookingStore = create<RideBookingState>()((set, get) => ({
  ...INITIAL_STATE,

  setStop(index, location) {
    set((s) => {
      const next = [...s.stops];
      next[index] = location;
      return { stops: next };
    });
  },

  addStop() {
    const { stops } = get();
    if (stops.length >= MAX_STOPS) return false;
    set({ stops: [...stops, null], activeStopIndex: stops.length });
    return true;
  },

  removeStop(index) {
    set((s) => {
      if (s.stops.length <= 1) return s; // keep at least 1
      const next = s.stops.filter((_, i) => i !== index);
      const newActive = Math.min(s.activeStopIndex, next.length - 1);
      return { stops: next, activeStopIndex: newActive };
    });
  },

  setActiveStopIndex(index) {
    set({ activeStopIndex: index });
  },

  setVehicleType(type) {
    set({ vehicleType: type });
  },

  togglePetFriendly() {
    set((s) => ({ petFriendly: !s.petFriendly }));
  },

  setFuelPreference(pref) {
    set({ fuelPreference: pref });
  },

  setPickup(location) {
    set({ pickup: location });
  },

  setPickupNote(note) {
    set({ pickupNote: note });
  },

  setPickupPhotoUri(uri) {
    set({ pickupPhotoUri: uri });
  },

  setRouteQuote(data) {
    set({
      routeQuoteId: data.routeQuoteId,
      encodedPolyline: data.encodedPolyline,
      speedReadingIntervals: data.speedReadingIntervals,
      standardFare: data.standardFare,
      plusFare: data.plusFare,
      distanceKm: data.distanceKm,
      durationMinutes: data.durationMinutes,
      currency: data.currency,
    });
  },

  clearRouteQuote() {
    set({
      routeQuoteId: null,
      encodedPolyline: null,
      speedReadingIntervals: null,
      standardFare: null,
      plusFare: null,
      distanceKm: null,
      durationMinutes: null,
    });
  },

  reset() {
    set({ ...INITIAL_STATE, stops: [null] });
  },
}));
