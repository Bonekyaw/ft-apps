import { useQuery } from "@tanstack/react-query";
import {
  fetchSavedPlaces,
  fetchRideHistory,
  type SavedPlace,
  type RideHistoryItem,
} from "@/lib/api";

/** Saved places for the current user. */
export function useSavedPlaces() {
  return useQuery<SavedPlace[], Error>({
    queryKey: ["saved-places"],
    queryFn: fetchSavedPlaces,
    staleTime: 60_000,
  });
}

/** Recent completed / cancelled rides (max 10). */
export function useRideHistory() {
  return useQuery<RideHistoryItem[], Error>({
    queryKey: ["ride-history"],
    queryFn: () => fetchRideHistory(10),
    staleTime: 60_000,
  });
}
