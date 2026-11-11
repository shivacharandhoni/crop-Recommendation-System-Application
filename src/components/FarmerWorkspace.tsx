import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Check, CloudSun, Database, Download, ExternalLink, Leaf, MapPin, Mic, Moon, Phone, Play, Save, Sun, Trash2, Volume2 } from "lucide-react";
import type { UiLanguage } from "@/lib/farmerLocale";
import { COUNTRIES, t, UI_LANGUAGES } from "@/lib/farmerLocale";
import {
  appendWorkspaceEvent, areaInHectares, clearCloudWorkspace, clearLocalWorkspace,
  isSupabaseConfigured, loadWorkspace, saveWeather, syncWorkspaceEvents,
  type CalendarTask, type CostEstimate, type FarmProfile, type FarmWorkspace,
  type SavedAdvice, type ServiceEntry, type ServiceKind, type TaskKind, type WeatherSnapshot,
} from "@/lib/farmWorkspace";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

type Recommendation = {
  crop: string; score: number; predicted_yield: number; suitability_score: number;
  explanation?: { rule_factors: Record<string, number>; rule_inputs_used: string[]; rule_inputs_not_used: string[]; model_inputs_used: string[]; notice: string };
};
type Props = {
  language: UiLanguage;
  countryCode: string;
  onCountryCodeChange: (countryCode: string) => void;
  recommendations: Recommendation[] | null;
  currentCrop: string;
  currentAreaHa: number;
  onApplyProfile: (profile: FarmProfile) => void;
  onUpdateForm: (values: Partial<{ state: string; district: string; soil_type: string; ph: number; nitrogen: number; phosphorus: number; potassium: number; area: number; crop: string }>) => void;
};

const SOILS = ["Clay", "Loam", "Sandy Loam", "Black Soil", "Red Soil", "Alluvial"];
const CROPS = ["Rice", "Wheat", "Maize", "Cotton", "Sugarcane", "Pulses", "Soyabean", "Groundnut"];
const supportedCurrencies = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("currency");
const CURRENCIES = supportedCurrencies?.length ? supportedCurrencies : ["INR", "NPR", "BDT", "LKR", "PKR", "USD"];
const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });
const WEATHER_SOURCE = "Open-Meteo Forecast API";
const localSyncKey = "crop-recommendation-cloud-sync";
const field = "min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";
const label = "mb-1 block text-sm font-semibold text-stone-700";
const card = "rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6";

function weatherLabel(code: number, lang: UiLanguage) {
  const en: Record<number, string> = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 81: "Rain showers", 82: "Heavy showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm" };
  const hi: Record<number, string> = { 0: "साफ़", 1: "अधिकतर साफ़", 2: "आंशिक बादल", 3: "बादल", 45: "कोहरा", 48: "कोहरा", 51: "बूंदाबांदी", 53: "बूंदाबांदी", 55: "तेज़ बूंदाबांदी", 61: "हल्की बारिश", 63: "बारिश", 65: "तेज़ बारिश", 71: "बर्फ़", 73: "बर्फ़", 75: "तेज़ बर्फ़", 80: "बारिश की बौछार", 81: "बारिश की बौछार", 82: "तेज़ बौछार", 95: "आंधी", 96: "आंधी", 99: "आंधी" };
  const te: Record<number, string> = { 0: "ఆకాశం నిర్మలం", 1: "ఎక్కువగా నిర్మలం", 2: "కొంత మేఘావృతం", 3: "మేఘావృతం", 45: "పొగమంచు", 48: "పొగమంచు", 51: "చినుకులు", 53: "చినుకులు", 55: "భారీ చినుకులు", 61: "తేలికపాటి వర్షం", 63: "వర్షం", 65: "భారీ వర్షం", 71: "మంచు", 73: "మంచు", 75: "భారీ మంచు", 80: "వర్షపు జల్లులు", 81: "వర్షపు జల్లులు", 82: "భారీ జల్లులు", 95: "ఉరుములతో కూడిన వర్షం", 96: "ఉరుములతో కూడిన వర్షం", 99: "ఉరుములతో కూడిన వర్షం" };
  return (lang === "hi" ? hi : lang === "te" ? te : en)[code] ?? (lang === "hi" ? "बदलता मौसम" : lang === "te" ? "మారే వాతావరణం" : "Variable conditions");
}

function nowLocalInput() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return date.toISOString().slice(0, 16);
}

export default function FarmerWorkspace({ language, countryCode, onCountryCodeChange, recommendations, currentCrop, currentAreaHa, onApplyProfile, onUpdateForm }: Props) {
  const tr = (key: string) => t(language, key);
  const [workspace, setWorkspace] = useState<FarmWorkspace | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncEnabled, setSyncEnabled] = useState(localStorage.getItem(localSyncKey) === "true");
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [profileDraft, setProfileDraft] = useState<FarmProfile | null>(null);
  const [profileMessage, setProfileMessage] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [weatherStale, setWeatherStale] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const [taskCrop, setTaskCrop] = useState(currentCrop || "Rice");
  const [taskKind, setTaskKind] = useState<TaskKind>("sowing");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState(nowLocalInput());
  const [taskNotes, setTaskNotes] = useState("");
  const [taskReminder, setTaskReminder] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [taskFeedback, setTaskFeedback] = useState("");
  const [costCrop, setCostCrop] = useState(currentCrop || "Rice");
  const [currency, setCurrency] = useState("INR");
  const [costDraft, setCostDraft] = useState({ seedPerHa: 0, fertilizerPerHa: 0, laborPerHa: 0, equipmentPerHa: 0, salePricePerTon: 0 });
  const [serviceKind, setServiceKind] = useState<ServiceKind>("officer");
  const [editingService, setEditingService] = useState<string | null>(null);
  const [serviceDraft, setServiceDraft] = useState({ name: "", address: "", phone: "", source: "", sourceUrl: "", lastUpdated: new Date().toISOString().slice(0, 10), notes: "" });
  const [serviceFilter, setServiceFilter] = useState("");
  const [serviceFeedback, setServiceFeedback] = useState("");
  const [reminderReady, setReminderReady] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");
  const { startListening, stopListening, transcript, isListening, isSupported, error: speechError, setLanguage: setRecognitionLanguage } = useSpeechRecognition();
  const [voiceFeedback, setVoiceFeedback] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const refresh = useCallback(async () => {
    const data = await loadWorkspace();
    setWorkspace(data);
    setProfileDraft(data.profile);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline); window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);
  useEffect(() => { setRecognitionLanguage(UI_LANGUAGES.find((item) => item.code === language)?.speech ?? ""); }, [language, setRecognitionLanguage]);
  useEffect(() => { if (speechError) setVoiceFeedback(`${tr("speechInputUnavailable")} (${speechError})`); }, [speechError, language]);

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured() || !online) { setSyncStatus("error"); return; }
    setSyncStatus("syncing");
    try { await syncWorkspaceEvents(); await refresh(); setSyncStatus("done"); }
    catch (error) { console.warn("Farm workspace sync unavailable:", error); setSyncStatus("error"); }
  }, [online, refresh]);

  useEffect(() => { if (syncEnabled && online && isSupabaseConfigured()) void syncNow(); }, [syncEnabled, online, syncNow]);

  const commit = useCallback(async (kind: "profile" | "task" | "advice" | "cost" | "service", key: string, payload: object | null, deleted = false) => {
    await appendWorkspaceEvent(kind, key, payload, deleted);
    await refresh();
    if (syncEnabled && online) await syncNow();
  }, [online, refresh, syncEnabled, syncNow]);

  useEffect(() => {
    if (transcript && !isListening) setTaskNotes((old) => [old, transcript].filter(Boolean).join(" ").trim());
  }, [transcript, isListening]);
  useEffect(() => {
    if (!workspace?.profile || workspace.profile.updatedAt === new Date(0).toISOString()) return;
    const saved = workspace.profile;
    onUpdateForm({ state: saved.state, district: saved.district, soil_type: saved.soilType, ph: saved.ph, nitrogen: saved.nitrogen, phosphorus: saved.phosphorus, potassium: saved.potassium, area: areaInHectares(saved.area, saved.areaUnit), crop: saved.usualCrops[0] });
  }, [workspace?.profile?.updatedAt]);

  useEffect(() => {
    if (!workspace?.tasks || !reminderReady) return;
    const check = () => {
      const now = Date.now();
      for (const task of workspace.tasks) {
        if (!task.reminder || task.completed || new Date(task.dueAt).getTime() > now) continue;
        const key = `crop-task-notified-${task.id}`;
        if (localStorage.getItem(key)) continue;
        new Notification(task.title, { body: `${task.crop} · ${task.notes || task.kind}` });
        localStorage.setItem(key, new Date().toISOString());
      }
    };
    check(); const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [workspace?.tasks, reminderReady]);

  const profile = profileDraft ?? workspace?.profile;
  const pendingCount = workspace?.events.filter((event) => event.pending).length ?? 0;
  const weather = workspace?.weather;
  const areaHa = profile && profile.updatedAt !== new Date(0).toISOString() ? areaInHectares(profile.area, profile.areaUnit) : currentAreaHa;

  useEffect(() => {
    const savedCost = workspace?.costs.find((item) => item.crop === costCrop);
    if (savedCost) {
      setCurrency(savedCost.currency);
      setCostDraft({ seedPerHa: savedCost.seedPerHa, fertilizerPerHa: savedCost.fertilizerPerHa, laborPerHa: savedCost.laborPerHa, equipmentPerHa: savedCost.equipmentPerHa, salePricePerTon: savedCost.salePricePerTon });
    } else setCostDraft({ seedPerHa: 0, fertilizerPerHa: 0, laborPerHa: 0, equipmentPerHa: 0, salePricePerTon: 0 });
  }, [costCrop, workspace?.costs]);

  const refreshForecast = useCallback(async (coords?: { latitude: number; longitude: number }) => {
    setWeatherLoading(true); setWeatherError(""); setWeatherStale(false);
    try {
      const search = new URLSearchParams();
      if (coords) { search.set("latitude", String(coords.latitude)); search.set("longitude", String(coords.longitude)); }
      else {
        const p = profile ?? workspace?.profile;
        const place = [p?.district, p?.state].filter(Boolean).join(", ");
        if (!place) throw new Error(tr("searchLocation"));
        search.set("location", place); search.set("country_code", countryCode || p?.countryCode || "IN");
      }
      const response = await fetch(`/api/weather?${search.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || tr("weatherUnavailable"));
      const snapshot: WeatherSnapshot = { location: data.location, latitude: data.latitude, longitude: data.longitude, timezone: data.timezone, days: data.days, fetchedAt: data.fetchedAt, source: data.source };
      await saveWeather(snapshot); setWorkspace(await loadWorkspace());
    } catch (error) {
      setWeatherError(error instanceof Error ? error.message : tr("weatherUnavailable"));
      const cached = (await loadWorkspace()).weather;
      if (cached) { setWorkspace((old) => old ? { ...old, weather: cached } : old); setWeatherStale(true); }
    } finally { setWeatherLoading(false); }
  }, [countryCode, profile, tr, workspace?.profile]);

  const alerts = useMemo(() => (weather?.days ?? []).flatMap((day) => {
    const items: Array<{ title: string; action: string; code: string }> = [];
    if (day.maxC >= 40) items.push({ title: tr("heatAlert"), action: tr("heatAction"), code: "heat" });
    if (day.precipitationMm >= 50) items.push({ title: tr("rainAlert"), action: tr("rainAction"), code: "rain" });
    return items.map((alert) => ({ ...alert, date: day.date }));
  }), [weather, language]);

  const geoWeather = () => {
    setGeoError(false);
    if (!navigator.geolocation) { setGeoError(true); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => void refreshForecast({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => setGeoError(true), { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const saveProfile = async () => {
    if (!profile) return;
    if (!profile.state.trim() || !profile.district.trim() || !profile.soilType || !Number.isFinite(profile.area) || profile.area <= 0 || profile.area > 100000 || !Number.isFinite(profile.ph) || profile.ph < 0 || profile.ph > 14 || [profile.nitrogen, profile.phosphorus, profile.potassium].some((value) => !Number.isFinite(value) || value < 0 || value > 500)) {
      setProfileMessage(language === "hi" ? "स्थान, मिट्टी और संख्यात्मक मान जाँचें।" : language === "te" ? "ప్రాంతం, నేల, సంఖ్యా విలువలు సరిచూడండి." : "Enter the location, soil type and valid numeric values.");
      return;
    }
    const country = COUNTRIES.find((item) => item.code === countryCode);
    const next = { ...profile, country: country?.name ?? profile.country, countryCode, updatedAt: new Date().toISOString() };
    await commit("profile", "farm-profile", next);
    setProfileDraft(next); setProfileMessage(tr("profileSaved"));
    onApplyProfile(next);
  };

  const saveCurrentAdvice = async () => {
    if (!recommendations?.length) return;
    const record: SavedAdvice = {
      id: crypto.randomUUID(), crop: currentCrop, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      payload: { recommendations, reasons: [] },
    };
    await commit("advice", record.id, record);
  };

  const submitTask = async (event: React.FormEvent) => {
    event.preventDefault();
    const kindTitle = tr(taskKind);
    const prior = workspace?.tasks.find((item) => item.id === editingTask);
    const task: CalendarTask = {
      id: editingTask || crypto.randomUUID(), crop: taskCrop, kind: taskKind,
      title: taskTitle.trim() || `${kindTitle} · ${taskCrop}`, dueAt: new Date(taskDue).toISOString(),
      notes: taskNotes.trim(), completed: prior?.completed ?? false, reminder: taskReminder, updatedAt: new Date().toISOString(),
    };
    await commit("task", task.id, task);
    setEditingTask(null); setTaskTitle(""); setTaskNotes(""); setTaskDue(nowLocalInput()); setTaskReminder(false); setTaskFeedback(tr("saved"));
  };

  const editTask = (task: CalendarTask) => {
    setEditingTask(task.id); setTaskCrop(task.crop); setTaskKind(task.kind); setTaskTitle(task.title);
    setTaskDue(new Date(new Date(task.dueAt).getTime() - new Date(task.dueAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setTaskNotes(task.notes); setTaskReminder(task.reminder); window.location.hash = "calendar";
  };
  const toggleTask = async (task: CalendarTask) => commit("task", task.id, { ...task, completed: !task.completed, updatedAt: new Date().toISOString() });
  const deleteTask = async (task: CalendarTask) => commit("task", task.id, null, true);

  const saveCost = async () => {
    const cost: CostEstimate = { crop: costCrop, currency, ...costDraft, updatedAt: new Date().toISOString() };
    await commit("cost", costCrop, cost);
  };
  const costFor = (crop: string) => workspace?.costs.find((entry) => entry.crop === crop && entry.currency === currency);
  const money = (value: number) => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

  const addService = async (event: React.FormEvent) => {
    event.preventDefault();
    const entry: ServiceEntry = { id: editingService ?? crypto.randomUUID(), kind: serviceKind, ...serviceDraft, updatedAt: new Date().toISOString() };
    await commit("service", entry.id, entry); setEditingService(null); setServiceDraft((old) => ({ ...old, name: "", address: "", phone: "", source: "", sourceUrl: "", notes: "" })); setServiceFeedback(tr("saved"));
  };
  const editService = (entry: ServiceEntry) => {
    setEditingService(entry.id); setServiceKind(entry.kind);
    setServiceDraft({ name: entry.name, address: entry.address, phone: entry.phone, source: entry.source, sourceUrl: entry.sourceUrl, lastUpdated: entry.lastUpdated, notes: entry.notes });
    window.location.hash = "services";
  };

  const useSpeechForNotes = () => {
    if (!isSupported) { setVoiceFeedback(tr("speechInputUnavailable")); return; }
    if (isListening) stopListening(); else { setVoiceFeedback(""); startListening(); }
  };
  const speakText = (value: string) => {
    if (!("speechSynthesis" in window)) { setVoiceFeedback(tr("voiceUnavailable")); return; }
    window.speechSynthesis.cancel();
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith(language));
    if (!voice) { setVoiceFeedback(tr("voiceUnavailable")); return; }
    const utterance = new SpeechSynthesisUtterance(value); utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true); utterance.onend = () => setIsSpeaking(false); utterance.onerror = () => { setIsSpeaking(false); setVoiceFeedback(tr("voiceUnavailable")); };
    setVoiceFeedback(""); window.speechSynthesis.speak(utterance);
  };
  const speakWeather = () => {
    const summary = [...alerts.map((item) => `${item.title}. ${item.action}`), ...(weather?.days.slice(0, 2).map((day) => `${day.date}: ${weatherLabel(day.weatherCode, language)}, ${Math.round(day.minC)} to ${Math.round(day.maxC)} degrees Celsius, ${Math.round(day.precipitationMm)} millimetres rain.`) ?? [])].join(" ");
    if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); } else if (summary) speakText(summary);
  };

  const requestReminderPermission = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission(); setReminderReady(permission === "granted");
  };
  const toggleCloudSync = async (enabled: boolean) => {
    setSyncEnabled(enabled); localStorage.setItem(localSyncKey, String(enabled));
  };
  const clearData = async (cloud: boolean) => {
    if (!window.confirm(tr("privacyConfirm"))) return;
    try {
      if (cloud && syncEnabled && isSupabaseConfigured()) await clearCloudWorkspace();
      else await clearLocalWorkspace();
      await refresh(); setSyncEnabled(false); localStorage.setItem(localSyncKey, "false"); setSyncStatus("idle");
    } catch (error) { console.error("Unable to clear workspace", error); setSyncStatus("error"); }
  };

  const exportData = () => {
    if (!workspace) return;
    const blob = new Blob([JSON.stringify({ profile: workspace.profile, tasks: workspace.tasks, advice: workspace.advice, costs: workspace.costs, services: workspace.services }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "crop-farm-workspace.json"; link.click(); URL.revokeObjectURL(url);
  };

  if (!workspace || !profile) return <section className={card} aria-live="polite">{tr("loading")}</section>;

  const locationLabel = [profile.district, profile.state, profile.country].filter(Boolean).join(", ");
  const serviceKinds: ServiceKind[] = ["officer", "soil_lab", "seed_supplier", "emergency"];
  const visibleServices = workspace.services.filter((entry) => !serviceFilter || `${entry.name} ${entry.address} ${tr(entry.kind)}`.toLocaleLowerCase().includes(serviceFilter.toLocaleLowerCase()));
  const factorLabels: Record<string, string> = { ph: tr("ph"), nitrogen: tr("nitrogen"), temperature: tr("temperature"), rainfall: tr("rainfall"), season: tr("season") };

  return <section className="mt-8 space-y-6" aria-label={tr("tools")}>
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">{tr("tools")}</p><h2 className="mt-1 text-2xl font-extrabold">{tr("profile")} · {tr("weather")} · {tr("calendar")}</h2></div>
        <div role="status" className={`rounded-full px-3 py-2 text-sm font-semibold ${online ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{online ? tr("online") : tr("offline")} · {syncStatus === "syncing" ? tr("syncing") : syncEnabled ? tr("syncOn") : tr("syncOff")}{pendingCount > 0 ? ` · ${pendingCount} ${tr("queued")}` : ""}</div>
      </div>
      <p className="mt-2 text-sm leading-6 text-stone-600">{tr("languageLimit")}</p>
      <nav aria-label={tr("tools")} className="mt-4 flex gap-2 overflow-x-auto pb-1 text-sm">
        {[["profile", tr("profile")], ["weather", tr("weather")], ["calendar", tr("calendar")], ["economics", tr("economics")], ["services", tr("services")], ["privacy", tr("privacy")]].map(([id, title]) => <a key={id} href={`#${id}`} className="min-h-11 shrink-0 rounded-full border border-stone-300 bg-white px-4 py-3 font-semibold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-600">{title}</a>)}
      </nav>
    </div>

    <section id="profile" className={card}>
      <div className="flex items-start gap-3"><span className="rounded-xl bg-emerald-100 p-3 text-emerald-800"><Leaf className="h-5 w-5" /></span><div><h3 className="text-xl font-bold">{tr("profile")}</h3><p className="text-sm leading-5 text-stone-600">{tr("profileHelp")}</p></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label><span className={label}>{tr("country")}</span><select className={field} value={countryCode} onChange={(event) => { const item = COUNTRIES.find((country) => country.code === event.target.value); onCountryCodeChange(event.target.value); setProfileDraft({ ...profile, country: item?.name ?? "India", countryCode: event.target.value }); }} aria-label={tr("country")}>{COUNTRIES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
        <label><span className={label}>{tr("state")}</span><input className={field} value={profile.state} onChange={(event) => setProfileDraft({ ...profile, state: event.target.value })} /></label>
        <label><span className={label}>{tr("district")}</span><input className={field} value={profile.district} onChange={(event) => setProfileDraft({ ...profile, district: event.target.value })} /></label>
        <label><span className={label}>{tr("land")}</span><input className={field} min="0.01" type="number" step="0.1" value={profile.area} onChange={(event) => setProfileDraft({ ...profile, area: Number(event.target.value) })} /></label>
        <label><span className={label}>{tr("areaUnit")}</span><select className={field} value={profile.areaUnit} onChange={(event) => setProfileDraft({ ...profile, areaUnit: event.target.value as FarmProfile["areaUnit"] })}><option value="ha">{tr("hectares")}</option><option value="acre">{tr("acres")}</option></select></label>
        <label><span className={label}>{tr("soil")}</span><select className={field} value={profile.soilType} onChange={(event) => setProfileDraft({ ...profile, soilType: event.target.value })}><option value="">Select…</option>{SOILS.map((item) => <option key={item}>{item}</option>)}</select></label>
        {([["ph", "pH", 0, 14, 0.1], ["nitrogen", "N kg/ha", 0, 500, 1], ["phosphorus", "P kg/ha", 0, 500, 1], ["potassium", "K kg/ha", 0, 500, 1]] as const).map(([key, name, min, max, step]) => <label key={key}><span className={label}>{tr(key)} · {name}</span><input className={field} type="number" min={min} max={max} step={step} value={profile[key]} onChange={(event) => setProfileDraft({ ...profile, [key]: Number(event.target.value) })} /></label>)}
      </div>
      <p className="mt-2 text-xs leading-5 text-stone-500">{tr("measurementLimits")}</p>
      <fieldset className="mt-4"><legend className={label}>{tr("usualCrops")}</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{CROPS.map((crop) => <label key={crop} className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm"><input type="checkbox" checked={profile.usualCrops.includes(crop)} onChange={(event) => setProfileDraft({ ...profile, usualCrops: event.target.checked ? [...profile.usualCrops, crop] : profile.usualCrops.filter((item) => item !== crop) })} />{crop}</label>)}</div></fieldset>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white" onClick={() => void saveProfile()}><Save className="mr-2 inline h-4 w-4" />{tr("saveProfile")}</button><button type="button" className="min-h-11 rounded-xl border border-emerald-800 px-4 py-3 font-bold text-emerald-900" onClick={() => onApplyProfile(profile)}>{tr("applyProfile")}</button>{profileMessage && <span role="status" className="self-center text-sm text-emerald-800">{profileMessage}</span>}</div>
      <details className="mt-4 rounded-2xl bg-stone-50 p-4"><summary className="cursor-pointer text-sm font-bold">{tr("privacy")}</summary><p className="mt-2 text-sm text-stone-600">{tr("localStorageNote")}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={exportData} className="min-h-11 rounded-xl border px-3 py-2 text-sm"><Download className="mr-2 inline h-4 w-4" />Export data</button><button type="button" onClick={() => void clearData(false)} className="min-h-11 rounded-xl border border-red-300 px-3 py-2 text-sm text-red-800"><Trash2 className="mr-2 inline h-4 w-4" />{tr("deleteLocal")}</button></div></details>
    </section>

    <section id="weather" className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="rounded-xl bg-sky-100 p-3 text-sky-900"><CloudSun className="h-5 w-5" /></span><div><h3 className="text-xl font-bold">{tr("weather")}</h3><p className="max-w-2xl text-sm leading-5 text-stone-600">{tr("weatherHelp")}</p><p className="mt-1 text-xs text-stone-500">{locationLabel || tr("searchLocation")}</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={geoWeather} className="min-h-11 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold"><MapPin className="mr-1 inline h-4 w-4" />{tr("useLocation")}</button><button type="button" onClick={() => void refreshForecast()} disabled={weatherLoading} className="min-h-11 rounded-xl bg-emerald-800 px-3 py-2 text-sm font-bold text-white">{weatherLoading ? tr("loading") : tr("refreshWeather")}</button></div></div>
      {geoError && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{tr("locationDenied")}</p>}
      {weatherError && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{weatherError}{weatherStale && ` ${tr("stale")}`}</p>}
      {!weather && !weatherLoading && <p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-stone-600">{tr("weatherUnavailable")} Choose a saved district or allow device location, then refresh. No placeholder weather is shown.</p>}
      {weather && <><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{weather.days.map((day) => <article key={day.date} className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><p className="font-bold">{new Intl.DateTimeFormat(language, { weekday: "short", month: "short", day: "numeric", timeZone: weather.timezone }).format(new Date(`${day.date}T12:00:00`))}</p><p className="mt-1 text-sm text-stone-600">{weatherLabel(day.weatherCode, language)}</p><p className="mt-3 text-lg font-extrabold">{Math.round(day.maxC)}° / {Math.round(day.minC)}°C</p><p className="mt-1 text-sm">{tr("rain")}: {day.precipitationMm.toFixed(1)} mm</p><p className="text-xs text-stone-500">{tr("rainChance")}: {day.precipitationProbability == null ? "—" : `${day.precipitationProbability}%`}</p></article>)}</div>
        {alerts.length > 0 && <div className="mt-4 space-y-2">{alerts.map((alert, index) => <div key={`${alert.code}-${alert.date}-${index}`} role="alert" className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><AlertTriangle className="mt-1 h-5 w-5 shrink-0" /><div><p className="font-bold">{alert.title} · {alert.date}</p><p className="mt-1 text-sm">{alert.action}</p></div></div>)}</div>}
        <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={speakWeather} className="min-h-11 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold">{isSpeaking ? <><Volume2 className="mr-2 inline h-4 w-4" />{tr("stopSpeech")}</> : <><Play className="mr-2 inline h-4 w-4" />{tr("speak")}</>}</button>{voiceFeedback && <p role="status" className="text-sm text-amber-900">{voiceFeedback}</p>}<p className="text-xs text-stone-500">Source: <a className="underline" href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">{WEATHER_SOURCE}</a> · updated {new Date(weather.fetchedAt).toLocaleString()}</p></div>
      </>}
    </section>

    <section id="calendar" className={card}>
      <div className="flex items-start gap-3"><span className="rounded-xl bg-violet-100 p-3 text-violet-900"><CalendarDays className="h-5 w-5" /></span><div><h3 className="text-xl font-bold">{tr("calendar")}</h3><p className="text-sm leading-5 text-stone-600">{tr("calendarHelp")}</p></div></div>
      <form onSubmit={(event) => void submitTask(event)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label><span className={label}>{tr("crop")}</span><select className={field} value={taskCrop} onChange={(event) => setTaskCrop(event.target.value)}>{CROPS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span className={label}>{tr("taskType")}</span><select className={field} value={taskKind} onChange={(event) => { const value = event.target.value as TaskKind; setTaskKind(value); if (!taskTitle) setTaskTitle(""); }}>{(["sowing", "irrigation", "fertilizing", "harvest", "other"] as TaskKind[]).map((item) => <option key={item} value={item}>{tr(item)}</option>)}</select></label>
        <label><span className={label}>{tr("taskTitle")}</span><input className={field} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder={`${tr(taskKind)} · ${taskCrop}`} /></label>
        <label><span className={label}>{tr("due")}</span><input className={field} type="datetime-local" required value={taskDue} onChange={(event) => setTaskDue(event.target.value)} /></label>
        <label className="sm:col-span-2"><span className={label}>{tr("notes")}</span><div className="flex gap-2"><input className={field} value={taskNotes} onChange={(event) => setTaskNotes(event.target.value)} /><button type="button" aria-label={tr("voiceInput")} title={tr("voiceInput")} onClick={useSpeechForNotes} className={`min-h-11 min-w-11 rounded-xl border ${isListening ? "border-red-500 bg-red-50" : "border-stone-300"}`}><Mic className="mx-auto h-5 w-5" /></button></div></label>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm"><input type="checkbox" checked={taskReminder} onChange={(event) => setTaskReminder(event.target.checked)} />{tr("reminder")}</label>
        <div className="flex items-center gap-2 sm:col-span-2"><button type="submit" className="min-h-11 rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white">{editingTask ? tr("edit") : tr("addTask")}</button>{editingTask && <button type="button" className="min-h-11 rounded-xl border px-4 py-2" onClick={() => { setEditingTask(null); setTaskTitle(""); setTaskNotes(""); }}>{tr("cancel")}</button>}{taskFeedback && <span role="status" className="text-sm text-emerald-800">{taskFeedback}</span>}</div>
      </form>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void requestReminderPermission()} className="min-h-11 rounded-xl border px-3 py-2 text-sm">{tr("enableReminders")}</button><span className="self-center text-xs text-stone-500">{reminderReady ? "Notifications enabled · reminders work while this app is open." : tr("reminderUnsupported")}</span>{voiceFeedback && <span role="status" className="self-center text-xs text-amber-900">{voiceFeedback}</span>}</div>
      {transcript && <p className="mt-2 text-sm text-stone-600">{tr("transcript")}: {transcript}</p>}
      <div className="mt-5 space-y-2">{workspace.tasks.length === 0 && <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">{tr("noTasks")}</p>}{workspace.tasks.map((task) => <article key={task.id} className={`flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4 ${task.completed ? "border-stone-200 bg-stone-50 opacity-75" : "border-emerald-100 bg-emerald-50/40"}`}><div className="flex min-w-0 gap-3"><span className="mt-1 rounded-lg bg-white p-2 text-emerald-800"><CalendarDays className="h-4 w-4" /></span><div><p className={`font-bold ${task.completed ? "line-through" : ""}`}>{task.title}</p><p className="text-sm text-stone-600">{task.crop} · {tr(task.kind)} · {new Date(task.dueAt).toLocaleString()}</p>{task.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">{task.notes}</p>}{task.reminder && <p className="mt-1 text-xs text-stone-500">Reminder {reminderReady ? "on while app is open" : "needs notification permission"}</p>}</div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void toggleTask(task)} className="min-h-11 rounded-xl border bg-white px-3 py-2 text-sm">{task.completed ? tr("reopen") : <><Check className="mr-1 inline h-4 w-4" />{tr("complete")}</>}</button><button type="button" onClick={() => editTask(task)} className="min-h-11 rounded-xl border bg-white px-3 py-2 text-sm">{tr("edit")}</button><button type="button" aria-label={tr("delete")} onClick={() => void deleteTask(task)} className="min-h-11 min-w-11 rounded-xl border bg-white px-3 py-2 text-red-800"><Trash2 className="mx-auto h-4 w-4" /></button></div></article>)}</div>
    </section>

    <section id="economics" className={card}>
      <div className="flex items-start gap-3"><span className="rounded-xl bg-amber-100 p-3 text-amber-900"><Database className="h-5 w-5" /></span><div><h3 className="text-xl font-bold">{tr("economics")}</h3><p className="text-sm leading-5 text-stone-600">{tr("economicsHelp")}</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label><span className={label}>{tr("crop")}</span><select className={field} value={costCrop} onChange={(event) => setCostCrop(event.target.value)}>{CROPS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span className={label}>{tr("currency")}</span><select className={field} value={currency} onChange={(event) => setCurrency(event.target.value)}>{CURRENCIES.map((item) => <option key={item} value={item}>{item} · {currencyNames.of(item) ?? item}</option>)}</select></label>
        {([["seedPerHa", "seedCost"], ["fertilizerPerHa", "fertilizerCost"], ["laborPerHa", "laborCost"], ["equipmentPerHa", "equipmentCost"], ["salePricePerTon", "price"]] as const).map(([key, title]) => <label key={key}><span className={label}>{tr(title)}</span><input className={field} type="number" min="0" step="0.01" value={costDraft[key]} onChange={(event) => setCostDraft((old) => ({ ...old, [key]: Math.max(0, Number(event.target.value)) }))} /></label>)}
      </div>
      <button type="button" onClick={() => void saveCost()} className="mt-3 min-h-11 rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white">{tr("saved")}</button>
      {!recommendations?.length ? <p className="mt-3 text-sm text-stone-600">{tr("requiresRecommendation")}</p> : <>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-200"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-stone-100"><tr><th className="p-3">{tr("crop")}</th><th className="p-3">{tr("model")} (t/ha)</th><th className="p-3">{tr("estimatedCost")}</th><th className="p-3">{tr("grossRevenue")}</th><th className="p-3">{tr("netReturn")}</th></tr></thead><tbody>{recommendations.map((item) => { const entry = item.crop === costCrop ? { ...costDraft, currency } : costFor(item.crop); const costs = entry ? (entry.seedPerHa + entry.fertilizerPerHa + entry.laborPerHa + entry.equipmentPerHa) * areaHa : 0; const revenue = entry ? item.predicted_yield * areaHa * entry.salePricePerTon : 0; return <tr key={item.crop} className="border-t border-stone-200"><th className="p-3">{item.crop}</th><td className="p-3">{item.predicted_yield.toFixed(2)}</td><td className="p-3">{entry ? money(costs) : "—"}</td><td className="p-3">{entry ? money(revenue) : "—"}</td><td className={`p-3 font-bold ${revenue - costs < 0 ? "text-red-700" : "text-emerald-800"}`}>{entry ? money(revenue - costs) : "—"}</td></tr>; })}</tbody></table></div>
        <p className="mt-2 text-xs text-stone-500">Area used: {areaHa.toFixed(2)} ha. Cost inputs are per hectare; sale prices are entered by you. Unfilled crop cost fields show as —.</p>
      </>}
    </section>

    <section id="services" className={card}>
      <div className="flex items-start gap-3"><span className="rounded-xl bg-blue-100 p-3 text-blue-900"><MapPin className="h-5 w-5" /></span><div><h3 className="text-xl font-bold">{tr("services")}</h3><p className="text-sm leading-5 text-stone-600">{tr("servicesHelp")}</p></div></div>
      <form onSubmit={(event) => void addService(event)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label><span className={label}>{tr("serviceType")}</span><select className={field} value={serviceKind} onChange={(event) => setServiceKind(event.target.value as ServiceKind)}>{serviceKinds.map((item) => <option key={item} value={item}>{tr(item)}</option>)}</select></label>
        <label><span className={label}>{tr("serviceName")}</span><input className={field} required value={serviceDraft.name} onChange={(event) => setServiceDraft({ ...serviceDraft, name: event.target.value })} /></label>
        <label><span className={label}>{tr("address")}</span><input className={field} required value={serviceDraft.address} onChange={(event) => setServiceDraft({ ...serviceDraft, address: event.target.value })} /></label>
        <label><span className={label}>{tr("phone")}</span><input className={field} type="tel" value={serviceDraft.phone} onChange={(event) => setServiceDraft({ ...serviceDraft, phone: event.target.value })} /></label>
        <label><span className={label}>{tr("source")}</span><input className={field} required value={serviceDraft.source} onChange={(event) => setServiceDraft({ ...serviceDraft, source: event.target.value })} /></label>
        <label><span className={label}>{tr("sourceUrl")}</span><input className={field} type="url" value={serviceDraft.sourceUrl} onChange={(event) => setServiceDraft({ ...serviceDraft, sourceUrl: event.target.value })} /></label>
        <label><span className={label}>{tr("lastUpdated")}</span><input className={field} type="date" required value={serviceDraft.lastUpdated} onChange={(event) => setServiceDraft({ ...serviceDraft, lastUpdated: event.target.value })} /></label>
        <label className="sm:col-span-2"><span className={label}>{tr("notes")}</span><input className={field} value={serviceDraft.notes} onChange={(event) => setServiceDraft({ ...serviceDraft, notes: event.target.value })} /></label>
        <button type="submit" className="min-h-11 self-end rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white">{editingService ? tr("edit") : tr("addService")}</button>{editingService && <button type="button" className="min-h-11 self-end rounded-xl border px-4 py-2" onClick={() => { setEditingService(null); setServiceDraft({ name: "", address: "", phone: "", source: "", sourceUrl: "", lastUpdated: new Date().toISOString().slice(0, 10), notes: "" }); }}>{tr("cancel")}</button>}{serviceFeedback && <span role="status" className="self-center text-sm text-emerald-800">{serviceFeedback}</span>}
      </form>
      <label className="mt-4 block max-w-lg"><span className={label}>{tr("searchLocation")}</span><input className={field} value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)} placeholder={locationLabel} /></label>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{visibleServices.length === 0 && <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">{tr("noServices")}</p>}{visibleServices.map((entry) => <article key={entry.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-bold">{entry.name}</p><p className="text-xs text-emerald-800">{tr(entry.kind)}</p></div><div className="flex gap-2"><button type="button" aria-label={tr("edit")} onClick={() => editService(entry)} className="min-h-11 min-w-11 rounded-xl border bg-white">{tr("edit")}</button><button type="button" aria-label={tr("delete")} onClick={() => void commit("service", entry.id, null, true)} className="min-h-11 min-w-11 rounded-xl border bg-white text-red-800"><Trash2 className="mx-auto h-4 w-4" /></button></div></div><p className="mt-2 text-sm">{entry.address}</p>{entry.phone && <a className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-900 underline" href={`tel:${entry.phone.replace(/[^+\d]/g, "")}`}><Phone className="h-4 w-4" />{tr("call")}: {entry.phone}</a>}<div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-600"><span>Source: {entry.source}</span><span>{tr("lastUpdated")}: {entry.lastUpdated}</span>{entry.sourceUrl && <a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">{tr("sourceUrl")} <ExternalLink className="h-3 w-3" /></a>}</div><a className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-blue-900 underline" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(entry.address)}`} target="_blank" rel="noreferrer">{tr("directions")}</a>{entry.notes && <p className="mt-2 text-sm text-stone-600">{entry.notes}</p>}</article>)}</div>
    </section>

    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-bold">{tr("explain")}</h3><p className="text-sm text-stone-600">{tr("scoreNotice")}</p></div>{recommendations?.length ? <button type="button" onClick={() => void saveCurrentAdvice()} className="min-h-11 rounded-xl border border-emerald-800 px-4 py-2 font-bold text-emerald-900"><Save className="mr-2 inline h-4 w-4" />{tr("saveAdvice")}</button> : null}</div>
      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{tr("syntheticWarning")}</p>
      {recommendations?.length ? <div className="mt-3 grid gap-3 md:grid-cols-2">{recommendations.map((item) => <article key={item.crop} className="rounded-2xl border border-stone-200 p-4"><div className="flex justify-between gap-3"><h4 className="font-bold">{item.crop}</h4><span className="text-sm font-bold">{tr("rule")}: {item.suitability_score}%</span></div><p className="mt-1 text-sm text-stone-600">{tr("model")}: {item.predicted_yield.toFixed(2)} t/ha · combined rank {item.score}</p><p className="mt-2 text-xs text-stone-500">{tr("usedInputs")}: {item.explanation?.rule_inputs_used.join(", ") || "pH, nitrogen, temperature, rainfall, season"}</p><details className="mt-2"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">{tr("explain")}</summary><dl className="grid grid-cols-2 gap-2 text-sm">{Object.entries(item.explanation?.rule_factors ?? {}).map(([key, value]) => <div key={key} className="rounded-lg bg-stone-50 p-2"><dt className="capitalize text-stone-600">{factorLabels[key] ?? key}</dt><dd className="font-bold">{value}/100</dd></div>)}</dl><p className="mt-2 text-xs text-stone-600">{tr("modelInputsUsed")}: {item.explanation?.model_inputs_used.join(", ") || "Model inputs unavailable"}</p><p className="mt-2 text-xs text-stone-600">{tr("notUsed")}: {item.explanation?.rule_inputs_not_used.join(", ") || "phosphorus, potassium, humidity, soil type"}. {tr("syntheticWarning")}</p></details></article>)}</div> : <p className="mt-3 text-sm text-stone-600">Run a recommendation to see its rule and model factors here.</p>}
      <div className="mt-5"><h4 className="font-bold">{tr("savedAdvice")}</h4>{workspace.advice.length === 0 ? <p className="mt-2 text-sm text-stone-600">{tr("noAdvice")}</p> : <ul className="mt-2 space-y-2">{workspace.advice.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 p-3"><span><strong>{item.crop}</strong> · {new Date(item.createdAt).toLocaleString()}</span><button type="button" aria-label={tr("delete")} onClick={() => void commit("advice", item.id, null, true)} className="min-h-11 min-w-11 rounded-xl border bg-white text-red-800"><Trash2 className="mx-auto h-4 w-4" /></button></li>)}</ul>}</div>
    </section>

    <section id="privacy" className={card}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-2xl"><h3 className="text-xl font-bold">{tr("privacy")}</h3><p className="mt-1 text-sm leading-5 text-stone-600">{tr("localStorageNote")}</p><p className="mt-2 text-xs leading-5 text-stone-500">Cloud sync uses anonymous Supabase authentication. Data is scoped to this browser's anonymous account; this doesn't create cross-device recovery or a named account. Supabase setup is required.</p></div><label className="flex min-h-11 items-center gap-3 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold"><input type="checkbox" role="switch" checked={syncEnabled} onChange={(event) => void toggleCloudSync(event.target.checked)} />{tr("cloudSync")}</label></div>
      <p className="mt-3 text-sm text-stone-600">{tr("syncHelp")}{!isSupabaseConfigured() ? " VITE_SUPABASE_URL / publishable key are not configured." : ""}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" disabled={!syncEnabled || !online} onClick={() => void syncNow()} className="min-h-11 rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white disabled:opacity-50">{tr("syncNow")}</button><span role="status" className="text-sm text-stone-600">{syncStatus === "syncing" ? tr("syncing") : syncStatus === "done" && pendingCount === 0 ? tr("synced") : syncStatus === "error" ? tr("syncError") : pendingCount ? `${pendingCount} ${tr("queued")}` : tr("syncOff")}</span></div>
      {syncEnabled && <button type="button" onClick={() => void clearData(true)} className="mt-3 min-h-11 rounded-xl border border-red-300 px-3 py-2 text-sm text-red-800"><Trash2 className="mr-2 inline h-4 w-4" />{tr("deleteCloud")}</button>}
    </section>
  </section>;
}
