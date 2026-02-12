import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { enterPresence, leavePresence } from "./ably";
import { startTracking, stopTracking } from "./location-tracker";

interface DriverStatusState {
  /** Whether the driver is currently online (presence entered). */
  isOnline: boolean;
  /** True while we are connecting / entering / leaving presence. */
  isTransitioning: boolean;
  /** Go online: connect + enter presence + start GPS tracking. */
  goOnline: (userId: string) => Promise<void>;
  /** Go offline: stop GPS tracking + leave presence + detach. */
  goOffline: () => Promise<void>;
  /** Reset store (e.g. on sign-out). Stops tracking but does NOT close Ably. */
  reset: () => void;
}

export const useDriverStatusStore = create<DriverStatusState>()(
  persist(
    (set) => ({
      isOnline: false,
      isTransitioning: false,

      goOnline: async (userId: string) => {
        set({ isTransitioning: true });
        try {
          await enterPresence(userId);
          await startTracking();
          set({ isOnline: true, isTransitioning: false });
        } catch {
          set({ isOnline: false, isTransitioning: false });
        }
      },

      goOffline: async () => {
        set({ isTransitioning: true });
        try {
          await stopTracking();
          await leavePresence();
        } finally {
          set({ isOnline: false, isTransitioning: false });
        }
      },

      reset: () => {
        void stopTracking();
        set({ isOnline: false, isTransitioning: false });
      },
    }),
    {
      name: "driver-status",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the online flag — not the transitioning state
      partialize: (state) => ({ isOnline: state.isOnline }),
    },
  ),
);
