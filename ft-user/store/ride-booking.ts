import { create } from "zustand";

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

  reset() {
    set({ ...INITIAL_STATE, stops: [null] });
  },
}));
