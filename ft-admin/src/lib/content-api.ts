import { authClient } from "./auth-client";

const BASE = import.meta.env.VITE_BETTER_AUTH_URL ?? "http://localhost:3000";

async function getAuthHeaders(): Promise<HeadersInit> {
  const res = await authClient.getSession();
  const token = (res as { data?: { session?: { token?: string } } })?.data
    ?.session?.token;
  if (!token) throw new Error("Not authenticated");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function getAuthToken(): Promise<string> {
  const res = await authClient.getSession();
  const token = (res as { data?: { session?: { token?: string } } })?.data
    ?.session?.token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

// ── Types ──

export interface BannerDto {
  id: string;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
  priority: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementDto {
  id: string;
  title: string;
  titleMy: string | null;
  body: string;
  bodyMy: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  priority: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BannerInput {
  title?: string;
  imageUrl: string;
  linkUrl?: string;
  priority?: number;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface AnnouncementInput {
  title: string;
  titleMy?: string;
  body: string;
  bodyMy?: string;
  imageUrl?: string;
  linkUrl?: string;
  priority?: number;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
}

// ── Image upload ──

export async function uploadImage(
  file: File,
  purpose: "banner" | "thumbnail" = "banner",
): Promise<string> {
  const token = await getAuthToken();
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);

  const res = await fetch(`${BASE}/admin/upload-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Image upload failed");
  }

  const data: { url: string } = await res.json();
  return data.url;
}

// ── Banners CRUD ──

export async function getBanners(): Promise<BannerDto[]> {
  const res = await fetch(`${BASE}/admin/banners`, {
    headers: await getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createBanner(input: BannerInput): Promise<BannerDto> {
  const res = await fetch(`${BASE}/admin/banners`, {
    method: "POST",
    headers: await getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateBanner(
  id: string,
  input: Partial<BannerInput>,
): Promise<BannerDto> {
  const res = await fetch(`${BASE}/admin/banners/${id}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteBanner(id: string): Promise<void> {
  const res = await fetch(`${BASE}/admin/banners/${id}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── Announcements CRUD ──

export async function getAnnouncements(): Promise<AnnouncementDto[]> {
  const res = await fetch(`${BASE}/admin/announcements`, {
    headers: await getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createAnnouncement(
  input: AnnouncementInput,
): Promise<AnnouncementDto> {
  const res = await fetch(`${BASE}/admin/announcements`, {
    method: "POST",
    headers: await getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateAnnouncement(
  id: string,
  input: Partial<AnnouncementInput>,
): Promise<AnnouncementDto> {
  const res = await fetch(`${BASE}/admin/announcements/${id}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const res = await fetch(`${BASE}/admin/announcements/${id}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
}
