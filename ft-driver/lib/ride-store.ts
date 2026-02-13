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
  /** Queue of additional requests that arrived while one is already showing. */
  requestQueue: IncomingRideRequest[];
  /** Set the active ride with full details. */
  setActiveRide: (ride: ActiveRide) => void;
  /** Clear the active ride. */
  clearActiveRide: () => void;
  /** Set an incoming ride request (from Ably private channel). */
  setIncomingRequest: (req: IncomingRideRequest | null) => void;
  /**
   * Enqueue a ride request. If no request is currently shown, display it
   * immediately. Otherwise, add it to the queue to be shown next.
   */
  enqueueRequest: (req: IncomingRideRequest) => void;
  /**
   * Clear the current request and auto-promote the next queued request.
   * Called after accept, reject, or timeout.
   */
  clearIncomingRequest: () => void;
  /**
   * Remove a specific ride from the queue (e.g. another driver accepted it).
   * If it's the currently-shown request, also clears it and promotes next.
   */
  removeRequest: (rideId: string) => void;
  /** Clear ALL pending requests and queue (used when driver goes ON_TRIP). */
  clearAllRequests: () => void;
}

export const useRideStore = create<RideState>()((set, get) => ({
  activeRide: null,
  activeRideId: null,
  incomingRequest: null,
  requestQueue: [],

  setActiveRide: (ride) =>
    set({ activeRide: ride, activeRideId: ride.rideId }),

  clearActiveRide: () => set({ activeRide: null, activeRideId: null }),

  setIncomingRequest: (req) => set({ incomingRequest: req }),

  enqueueRequest: (req) => {
    const { incomingRequest, requestQueue } = get();
    // Don't add duplicates
    if (incomingRequest?.rideId === req.rideId) return;
    if (requestQueue.some((r) => r.rideId === req.rideId)) return;

    if (!incomingRequest) {
      // Nothing showing — display immediately
      set({ incomingRequest: req });
    } else {
      // Already showing a request — queue this one
      set({ requestQueue: [...requestQueue, req] });
    }
  },

  clearIncomingRequest: () => {
    const { requestQueue } = get();
    if (requestQueue.length > 0) {
      // Promote the next queued request
      const [next, ...rest] = requestQueue;
      set({ incomingRequest: next, requestQueue: rest });
    } else {
      set({ incomingRequest: null });
    }
  },

  removeRequest: (rideId) => {
    const { incomingRequest, requestQueue } = get();
    if (incomingRequest?.rideId === rideId) {
      // The cancelled ride is the one currently showing — promote next
      if (requestQueue.length > 0) {
        const [next, ...rest] = requestQueue;
        set({ incomingRequest: next, requestQueue: rest });
      } else {
        set({ incomingRequest: null });
      }
    } else {
      // Don't remove queued requests — the driver hasn't seen them yet.
      // When promoted, acknowledgeRide() resets the backend timer.
      // If the ride is no longer available, accept will fail with 409.
    }
  },

  clearAllRequests: () => set({ incomingRequest: null, requestQueue: [] }),
}));
