export type AnalyticsEventName =
  | "run_started"
  | "first_finding"
  | "export_json"
  | "save_intent"
  | "upgrade_intent";

interface AnalyticsEvent {
  name: AnalyticsEventName;
  at: string;
  ttvMs?: number;
}

const STORAGE_KEY = "fundproof_analytics_v1";
const inMemoryEvents: AnalyticsEvent[] = [];

export function track(name: AnalyticsEventName, ttvMs?: number) {
  const event: AnalyticsEvent = {
    name,
    at: new Date().toISOString(),
    ...(ttvMs === undefined ? {} : { ttvMs }),
  };
  inMemoryEvents.push(event);
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as AnalyticsEvent[];
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing.slice(-49), event]));
  } catch {
    // In-memory tracking remains available when storage is unavailable.
  }
}
