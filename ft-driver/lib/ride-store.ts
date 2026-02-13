import { create } from "zustand";

/** Shape of the incoming ride request payload from Ably. */
export interface IncomingRideRequest {
  rideId: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  estimatedFare: number;
  currency: string;
  vehicleType: string;
  passengerNote: string | null;
  pickupPhotoUrl: string | null;
  extraPassengers: boolean;
}

/** Full details of the ride the driver has accepted. */
export interface ActiveRide {
  rideId: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  totalFare: number;
  currency: string;
  vehicleType: string;
  passengerNote: string | null;
  pickupPhotoUrl: string | null;
  extraPassengers: boolean;
}

interface RideState {
  /** The currently accepted ride with full details, or null. */
  activeRide: ActiveRide | null;
  /** Convenience getter — the active ride ID (used by location tracker). */
  activeRideId: string | null;
  /** An incoming ride request from dispatch, or null if none. */
  incomingRequest: IncomingRideRequest | null;
  /** Set the active ride with full details. */
  setActiveRide: (ride: ActiveRide) => void;
  /** Clear the active ride. */
  clearActiveRide: () => void;
  /** Set an incoming ride request (from Ably private channel). */
  setIncomingRequest: (req: IncomingRideRequest | null) => void;
  /** Clear the incoming request (after accept/reject/timeout). */
  clearIncomingRequest: () => void;
}

export const useRideStore = create<RideState>()((set) => ({
  activeRide: null,
  activeRideId: null,
  incomingRequest: null,

  setActiveRide: (ride) =>
    set({ activeRide: ride, activeRideId: ride.rideId }),

  clearActiveRide: () => set({ activeRide: null, activeRideId: null }),

  setIncomingRequest: (req) => set({ incomingRequest: req }),

  clearIncomingRequest: () => set({ incomingRequest: null }),
}));
