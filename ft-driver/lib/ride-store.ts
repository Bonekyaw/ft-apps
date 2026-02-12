import { create } from "zustand";

interface RideState {
  /** The ID of the currently active ride, or null if no ride. */
  activeRideId: string | null;
  /** Set or clear the active ride. Triggers high-frequency Ably tracking. */
  setActiveRide: (rideId: string | null) => void;
}

export const useRideStore = create<RideState>()((set) => ({
  activeRideId: null,
  setActiveRide: (rideId) => set({ activeRideId: rideId }),
}));
