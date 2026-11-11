import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type AreaUnit = "ha" | "acre";
export type TaskKind = "sowing" | "irrigation" | "fertilizing" | "harvest" | "other";
export type ServiceKind = "officer" | "soil_lab" | "seed_supplier" | "emergency";
export type EntityKind = "profile" | "task" | "advice" | "cost" | "service";

export interface FarmProfile {
  country: string; countryCode: string; state: string; district: string;
  latitude: number | null; longitude: number | null;
  area: number; areaUnit: AreaUnit; soilType: string; ph: number;
  nitrogen: number; phosphorus: number; potassium: number; usualCrops: string[]; updatedAt: string;
}
export interface CalendarTask {
  id: string; crop: string; kind: TaskKind; title: string; dueAt: string; notes: string;
  completed: boolean; reminder: boolean; updatedAt: string;
}
export interface CostEstimate {
  crop: string; currency: string; seedPerHa: number; fertilizerPerHa: number;
  laborPerHa: number; equipmentPerHa: number; salePricePerTon: number; updatedAt: string;
}
export interface SavedAdvice {
  id: string; crop: string; createdAt: string;
  payload: { recommendations: Array<{ crop: string; predicted_yield: number; score: number; suitability_score: number }>; reasons: string[] };
  updatedAt: string;
}
export interface ServiceEntry {
  id: string; kind: ServiceKind; name: string; address: string; phone: string;
  source: string; sourceUrl: string; lastUpdated: string; notes: string; updatedAt: string;
}
export interface WeatherDay {
  date: string; minC: number; maxC: number; precipitationMm: number;
  precipitationProbability: number | null; weatherCode: number;
}
export interface WeatherSnapshot {
  location: string; latitude: number; longitude: number; timezone: string;
  days: WeatherDay[]; fetchedAt: string; source: string;
}
export interface WorkspaceEvent {
  user_id?: string; event_id: string; entity_kind: EntityKind; entity_key: string;
  payload: Json; deleted: boolean; updated_at: string; pending: boolean;
}
export interface FarmWorkspace {
  profile: FarmProfile; tasks: CalendarTask[]; advice: SavedAdvice[]; costs: CostEstimate[];
  services: ServiceEntry[]; weather: WeatherSnapshot | null; events: WorkspaceEvent[];
}
interface WorkspaceDb extends DBSchema {
  events: { key: string; value: WorkspaceEvent; indexes: { "by-updated": string } };
  meta: { key: string; value: WeatherSnapshot };
}

const DB_NAME = "crop-recommendation-farm-data";
let dbPromise: Promise<IDBPDatabase<WorkspaceDb>> | null = null;
function getDb() {
  if (!dbPromise) dbPromise = openDB<WorkspaceDb>(DB_NAME, 1, {
    upgrade(db) {
      const events = db.createObjectStore("events", { keyPath: "event_id" });
      events.createIndex("by-updated", "updated_at");
      db.createObjectStore("meta");
    },
  });
  return dbPromise;
}

export const emptyProfile = (): FarmProfile => ({
  country: "India", countryCode: "IN", state: "", district: "",
  latitude: null, longitude: null, area: 0, areaUnit: "ha", soilType: "", ph: 0,
  nitrogen: 0, phosphorus: 0, potassium: 0, usualCrops: [], updatedAt: new Date(0).toISOString(),
});

export function reduceWorkspace(events: WorkspaceEvent[], weather: WeatherSnapshot | null): FarmWorkspace {
  const latest = new Map<string, WorkspaceEvent>();
  for (const event of events) {
    const key = `${event.entity_kind}:${event.entity_key}`;
    const old = latest.get(key);
    if (!old || old.updated_at < event.updated_at || (old.updated_at === event.updated_at && old.event_id < event.event_id)) latest.set(key, event);
  }
  const active = [...latest.values()].filter((event) => !event.deleted);
  const values = <T,>(kind: EntityKind) => active.filter((event) => event.entity_kind === kind).map((event) => event.payload as T);
  const profileEvent = active.find((event) => event.entity_kind === "profile");
  return {
    profile: profileEvent ? profileEvent.payload as FarmProfile : emptyProfile(),
    tasks: values<CalendarTask>("task").sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    advice: values<SavedAdvice>("advice").sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    costs: values<CostEstimate>("cost"),
    services: values<ServiceEntry>("service").sort((a, b) => a.name.localeCompare(b.name)),
    weather, events,
  };
}

export async function loadWorkspace(): Promise<FarmWorkspace> {
  const db = await getDb();
  const [events, weather] = await Promise.all([db.getAll("events"), db.get("meta", "weather")]);
  return reduceWorkspace(events, weather ?? null);
}
export async function appendWorkspaceEvent(kind: EntityKind, key: string, payload: object | null, deleted = false) {
  const event: WorkspaceEvent = {
    event_id: crypto.randomUUID(), entity_kind: kind, entity_key: key,
    payload: (payload ?? {}) as Json, deleted, updated_at: new Date().toISOString(), pending: true,
  };
  await (await getDb()).put("events", event);
  return event;
}
export async function saveWeather(snapshot: WeatherSnapshot) { await (await getDb()).put("meta", snapshot, "weather"); }
export async function clearLocalWorkspace() {
  const db = await getDb(); await db.clear("events"); await db.delete("meta", "weather");
}

export async function syncWorkspaceEvents() {
  const db = await getDb();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  let user = sessionData.session?.user;
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    user = data.user;
  }
  if (!user) throw new Error("Could not create a private cloud-sync session.");
  const pending = (await db.getAll("events")).filter((event) => event.pending);
  for (const event of pending) {
    const { error } = await supabase.from("farm_workspace_events").upsert({
      user_id: user.id, event_id: event.event_id, entity_kind: event.entity_kind,
      entity_key: event.entity_key, payload: event.payload, deleted: event.deleted, updated_at: event.updated_at,
    }, { onConflict: "user_id,event_id", ignoreDuplicates: true });
    if (error) throw error;
    await db.put("events", { ...event, user_id: user.id, pending: false });
  }
  const { data: remote, error } = await supabase.from("farm_workspace_events")
    .select("event_id,entity_kind,entity_key,payload,deleted,updated_at").eq("user_id", user.id);
  if (error) throw error;
  const known = new Set((await db.getAll("events")).map((event) => event.event_id));
  for (const row of remote ?? []) if (!known.has(row.event_id)) {
    await db.put("events", { ...row, user_id: user.id, pending: false });
  }
  return { uploaded: pending.length, queued: (await db.getAll("events")).filter((event) => event.pending).length };
}
export async function clearCloudWorkspace() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    const { error } = await supabase.from("farm_workspace_events").delete().eq("user_id", data.session.user.id);
    if (error) throw error;
  }
  await clearLocalWorkspace(); await supabase.auth.signOut();
}
export function areaInHectares(area: number, unit: AreaUnit) { return unit === "acre" ? area * 0.4046856422 : area; }
export function isSupabaseConfigured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
}
