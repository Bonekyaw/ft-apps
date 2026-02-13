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
// Booking flow types
// ---------------------------------------------------------------------------

export type BookingStatus =
  | "idle"
  | "searching"
  | "accepted"
  | "no_driver"
  | "driver_cancelled";

export interface AcceptedDriver {
  driverName: string;
  driverLocation: {
    latitude: number;
    longitude: number;
    heading: number | null;
  } | null;
}

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
  extraPassengers: boolean;

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

  // Booking flow (post-ride-creation)
  bookingStatus: BookingStatus;
  activeRideId: string | null;
  acceptedDriver: AcceptedDriver | null;
  skippedDriverUserIds: string[];

  // Actions — stops
  setStop: (index: number, location: StopLocation | null) => void;
  addStop: () => boolean;
  removeStop: (index: number) => void;
  setActiveStopIndex: (index: number) => void;

  // Actions — filters
  setVehicleType: (type: VehicleFilter) => void;
  togglePetFriendly: () => void;
  setFuelPreference: (pref: FuelFilter) => void;
  toggleExtraPassengers: () => void;

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

  // Actions — booking flow
  setBookingSearching: (rideId: string) => void;
  setBookingAccepted: (driver: AcceptedDriver) => void;
  setBookingNoDriver: () => void;
  setBookingDriverCancelled: () => void;
  addSkippedDriver: (userId: string) => void;
  resetBookingStatus: () => void;

  // Reset everything
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const BOOKING_FLOW_INITIAL = {
  bookingStatus: "idle" as BookingStatus,
  activeRideId: null as string | null,
  acceptedDriver: null as AcceptedDriver | null,
  skippedDriverUserIds: [] as string[],
};

const INITIAL_STATE = {
  stops: [null] as (StopLocation | null)[],
  activeStopIndex: 0,
  vehicleType: "ANY" as VehicleFilter,
  petFriendly: false,
  fuelPreference: "ANY" as FuelFilter,
  extraPassengers: false,
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
  ...BOOKING_FLOW_INITIAL,
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

  toggleExtraPassengers() {
    set((s) => ({ extraPassengers: !s.extraPassengers }));
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
      ...BOOKING_FLOW_INITIAL,
    });
  },

  // ── Booking flow actions ──

  setBookingSearching(rideId) {
    set({ bookingStatus: "searching", activeRideId: rideId });
  },

  setBookingAccepted(driver) {
    set({ bookingStatus: "accepted", acceptedDriver: driver });
  },

  setBookingNoDriver() {
    set({ bookingStatus: "no_driver" });
  },

  setBookingDriverCancelled() {
    set({ bookingStatus: "driver_cancelled" });
  },

  addSkippedDriver(userId: string) {
    set((s) => ({
      skippedDriverUserIds: s.skippedDriverUserIds.includes(userId)
        ? s.skippedDriverUserIds
        : [...s.skippedDriverUserIds, userId],
    }));
  },

  resetBookingStatus() {
    set({ ...BOOKING_FLOW_INITIAL });
  },

  reset() {
    set({ ...INITIAL_STATE, stops: [null] });
  },
}));
