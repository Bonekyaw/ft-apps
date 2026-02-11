import { authClient } from "./auth-client";

const BASE = import.meta.env.VITE_BETTER_AUTH_URL ?? "http://localhost:3000";

async function getAuthHeaders(): Promise<HeadersInit> {
  const res = await authClient.getSession();
  const token = (res as { data?: { session?: { token?: string } } })?.data
    ?.session?.token;
  if (!token) {
    throw new Error("Not authenticated");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ── Shared types ──

export interface DistanceBandDto {
  minKm: number;
  maxKm: number | null; // null = no upper limit
  perKmRate: number;
}

export interface SpecialDayRateDto {
  name: string;
  perKmRate: number;
  isWeekend: boolean;
  holidayDates: string[]; // "YYYY-MM-DD"
}

export interface TimeRuleDto {
  start: number;
  end: number;
  multiplier: number;
}

export interface PricingConfigDto {
  id?: string;
  vehicleType: string;
  baseFare: number;
  perKmRate: number;
  timeRate: number;
  bookingFee: number;
  surgeMultiplier: number;
  currency: string;
  timeRules?: TimeRuleDto[];
  distanceBands?: DistanceBandDto[];
  specialDayRates?: SpecialDayRateDto[];
  updatedAt?: string;
}

// ── Township surcharge types ──

export interface TownshipSurchargeDto {
  id: string;
  township: string;
  fixedCharge: number;
  updatedAt?: string;
}

export interface TownshipSurchargeInput {
  township: string;
  fixedCharge: number;
}

// ── API calls ──

export async function getPricingConfig(): Promise<PricingConfigDto[]> {
  const res = await fetch(`${BASE}/pricing/config`, {
    headers: await getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function putPricingConfig(
  body: Partial<PricingConfigDto>
): Promise<PricingConfigDto> {
  const res = await fetch(`${BASE}/pricing/config`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Township surcharge API calls ──

export async function getTownshipSurcharges(): Promise<
  TownshipSurchargeDto[]
> {
  const res = await fetch(`${BASE}/pricing/township-surcharges`, {
    headers: await getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function upsertTownshipSurcharge(
  body: TownshipSurchargeInput
): Promise<TownshipSurchargeDto> {
  const res = await fetch(`${BASE}/pricing/township-surcharges`, {
    method: "POST",
    headers: await getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteTownshipSurcharge(id: string): Promise<void> {
  const res = await fetch(`${BASE}/pricing/township-surcharges/${id}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
}
