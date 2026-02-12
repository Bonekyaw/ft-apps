import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { enterPresence, leavePresence } from "./ably";
import { startTracking, stopTracking } from "./location-tracker";
import { updateDriverStatus } from "./api";
import {
  subscribeToPrivateChannel,
  unsubscribeFromPrivateChannel,
} from "./ride-request-listener";

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
          // 1. Set status in DB via REST (reliable — doesn't depend on webhooks)
          await updateDriverStatus("ONLINE");
          // 2. Enter Ably presence (for real-time features)
          await enterPresence(userId);
          // 3. Start GPS tracking
          await startTracking();
          // 4. Subscribe to private ride request channel
          await subscribeToPrivateChannel(userId);
          set({ isOnline: true, isTransitioning: false });
        } catch {
          // Attempt to revert DB status on failure
          void updateDriverStatus("OFFLINE").catch(() => {});
          set({ isOnline: false, isTransitioning: false });
        }
      },

      goOffline: async () => {
        set({ isTransitioning: true });
        try {
          await unsubscribeFromPrivateChannel();
          await stopTracking();
          await leavePresence();
          // Set status in DB via REST (reliable)
          await updateDriverStatus("OFFLINE");
        } finally {
          set({ isOnline: false, isTransitioning: false });
        }
      },

      reset: () => {
        void unsubscribeFromPrivateChannel();
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
