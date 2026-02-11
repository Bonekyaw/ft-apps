import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ---- Types ----

export interface Banner {
  id: string;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  titleMy: string | null;
  body: string;
  bodyMy: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  createdAt: string;
}

// ---- Fetchers ----

async function fetchBanners(): Promise<Banner[]> {
  const { data } = await api.get<{ banners: Banner[] }>("/promotions/banners");
  return data.banners;
}

async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data } = await api.get<{ announcements: Announcement[] }>(
    "/announcements",
  );
  return data.announcements;
}

// ---- Hooks ----

export function useBanners() {
  return useQuery({
    queryKey: ["banners"],
    queryFn: fetchBanners,
    staleTime: 5 * 60_000, // fresh for 5 min
  });
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: fetchAnnouncements,
    staleTime: 5 * 60_000,
  });
}
