import { authClient } from "./auth-client";

const BASE = import.meta.env.VITE_BETTER_AUTH_URL ?? "http://localhost:3000";

async function getAuthHeaders(): Promise<HeadersInit> {
  const res = await authClient.getSession();
  const token = (res as { data?: { session?: { token?: string } } })?.data?.session?.token;
  if (!token) {
    throw new Error("Not authenticated");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export interface PricingDefaultsDto {
  id?: string;
  baseFareMinMmkt: number;
  baseFareMaxMmkt: number;
  initialKmForBase: number;
  perKmRateDefaultMmkt: number;
  taxiPlusMultiplier: number;
  currency: string;
  updatedAt?: string;
}

export async function getPricingDefaults(): Promise<PricingDefaultsDto> {
  const res = await fetch(`${BASE}/pricing/defaults`, {
    headers: await getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function putPricingDefaults(
  body: Partial<PricingDefaultsDto>
): Promise<PricingDefaultsDto> {
  const res = await fetch(`${BASE}/pricing/defaults`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface PricingRuleDto {
  id: string;
  name: string;
  active: boolean;
  priority: number;
  ruleType: "DISTANCE_BAND" | "TIME_OF_DAY" | "SPECIAL_DAY";
  minDistanceKm?: number | null;
  maxDistanceKm?: number | null;
  perKmRateMmkt?: number | null;
  startHour?: number | null;
  endHour?: number | null;
  timeSurgeMultiplier?: number | null;
  dayOfWeek?: number | null;
  isWeekend?: boolean | null;
  isHoliday?: boolean | null;
  holidayDate?: string | null;
  specialDayMultiplier?: number | null;
  createdAt: string;
  updatedAt: string;
}

export async function getPricingRules(): Promise<PricingRuleDto[]> {
  const res = await fetch(`${BASE}/pricing/rules`, {
    headers: await getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface CreatePricingRuleBody {
  name: string;
  active?: boolean;
  priority?: number;
  ruleType: "DISTANCE_BAND" | "TIME_OF_DAY" | "SPECIAL_DAY";
  minDistanceKm?: number;
  maxDistanceKm?: number;
  perKmRateMmkt?: number;
  startHour?: number;
  endHour?: number;
  timeSurgeMultiplier?: number;
  dayOfWeek?: number;
  isWeekend?: boolean;
  isHoliday?: boolean;
  holidayDate?: string;
  specialDayMultiplier?: number;
}

export async function createPricingRule(
  body: CreatePricingRuleBody
): Promise<{ id: string } & CreatePricingRuleBody> {
  const res = await fetch(`${BASE}/pricing/rules`, {
    method: "POST",
    headers: await getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updatePricingRule(
  id: string,
  body: Partial<CreatePricingRuleBody>
): Promise<void> {
  const res = await fetch(`${BASE}/pricing/rules/${id}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deletePricingRule(id: string): Promise<void> {
  const res = await fetch(`${BASE}/pricing/rules/${id}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
}
