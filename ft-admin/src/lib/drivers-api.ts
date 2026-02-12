/** API helpers for driver management. */

const BASE = import.meta.env.VITE_BETTER_AUTH_URL ?? "http://localhost:3000";

export interface Driver {
  id: string;
  userId: string;
  name: string;
  email: string;
  image?: string | null;
  phone?: string | null;
  banned?: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  status: "OFFLINE" | "ONLINE" | "ON_TRIP";
  licenseNumber?: string | null;
  licenseExpiry?: string | null;
  nationalId?: string | null;
  licenseImageUrl?: string | null;
  nationalIdImageUrl?: string | null;
  totalRides: number;
  totalEarnings?: string | number;
  averageRating: string | number;
  ratingCount?: number;
  vehicle?: unknown;
  createdAt: string;
}

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Request failed (${res.status})`
    );
  }
  return res;
}

export async function listDrivers(): Promise<Driver[]> {
  const res = await authFetch(`${BASE}/admin/drivers`);
  return res.json() as Promise<Driver[]>;
}

export async function getDriver(id: string): Promise<Driver> {
  const res = await authFetch(`${BASE}/admin/drivers/${id}`);
  return res.json() as Promise<Driver>;
}

export async function createDriver(name: string, email: string) {
  const res = await authFetch(`${BASE}/admin/drivers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email }),
  });
  return res.json();
}

export async function approveDriver(id: string) {
  const res = await authFetch(`${BASE}/admin/drivers/${id}/approve`, {
    method: "PATCH",
  });
  return res.json();
}

export async function rejectDriver(id: string) {
  const res = await authFetch(`${BASE}/admin/drivers/${id}/reject`, {
    method: "PATCH",
  });
  return res.json();
}

export async function suspendDriver(id: string) {
  const res = await authFetch(`${BASE}/admin/drivers/${id}/suspend`, {
    method: "PATCH",
  });
  return res.json();
}

export async function updateDriver(
  id: string,
  data: {
    licenseNumber?: string;
    licenseExpiry?: string;
    nationalId?: string;
  }
) {
  const res = await authFetch(`${BASE}/admin/drivers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteDriver(id: string) {
  const res = await authFetch(`${BASE}/admin/drivers/${id}`, {
    method: "DELETE",
  });
  return res.json();
}

export async function revokeDriverSessions(id: string) {
  const res = await authFetch(`${BASE}/admin/drivers/${id}/revoke-sessions`, {
    method: "POST",
  });
  return res.json();
}

export async function uploadDriverDocument(
  id: string,
  field: "licenseImageUrl" | "nationalIdImageUrl",
  file: File
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("field", field);

  const res = await authFetch(`${BASE}/admin/drivers/${id}/documents`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}
