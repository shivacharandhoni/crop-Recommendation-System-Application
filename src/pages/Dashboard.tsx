import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity, ArrowRight, Bug, Check, ChevronRight, CloudSun, Droplets, Leaf,
  MapPin, Moon, Shovel, Sparkles, Sprout, Sun, Thermometer, Wheat,
} from "lucide-react";
import FarmerWorkspace from "@/components/FarmerWorkspace";
import { useFarmerSettings } from "@/hooks/useFarmerSettings";
import { COUNTRIES, t, UI_LANGUAGES } from "@/lib/farmerLocale";
import { areaInHectares } from "@/lib/farmWorkspace";
import { apiUrl } from "@/lib/api";

type FarmInputs = {
  state: string; district: string; crop: string; season: string; soil_type: string;
  ph: number; nitrogen: number; phosphorus: number; potassium: number;
  temperature: number; rainfall: number; humidity: number; area: number; previous_yield: number;
};

type Recommendation = { crop: string; score: number; predicted_yield: number; suitability_score: number; explanation?: { rule_factors: Record<string, number>; rule_inputs_used: string[]; rule_inputs_not_used: string[]; model_inputs_used: string[]; notice: string } };
type RecommendationResult = {
  recommended_crop: string;
  recommendations: Recommendation[];
  reasons: string[];
  fertilizer: { suggestions: string[]; n_status: string; p_status: string; k_status: string };
  model: string;
};
type YieldResult = { crop: string; yield_per_hectare: number; estimated_total_yield: number; area_hectares: number; unit: string; model: string };

const initialInputs: FarmInputs = {
  state: "", district: "", crop: "Rice", season: "Kharif", soil_type: "Loam",
  ph: 6.5, nitrogen: 100, phosphorus: 50, potassium: 40, temperature: 25,
  rainfall: 800, humidity: 65, area: 1, previous_yield: 0,
};

const crops = ["Rice", "Wheat", "Maize", "Cotton", "Sugarcane", "Pulses", "Soyabean", "Groundnut"];
const seasons = ["Kharif", "Rabi", "Whole Year", "Zaid"];
const soils = ["Clay", "Loam", "Sandy Loam", "Black Soil", "Red Soil", "Alluvial"];
const fieldClass = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const labelClass = "mb-1.5 block text-xs font-semibold text-stone-600";

export default function Dashboard() {
  const settings = useFarmerSettings();
  const tr = (key: string) => t(settings.language, key);
  const [form, setForm] = useState<FarmInputs>(initialInputs);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [yieldResult, setYieldResult] = useState<YieldResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [yieldLoading, setYieldLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiReady, setApiReady] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/health")).then((response) => response.json()).then((data) => setApiReady(Boolean(data.model_ready))).catch(() => setApiReady(false));
  }, []);

  const change = (key: keyof FarmInputs, value: string) => {
    setForm((previous) => ({ ...previous, [key]: ["ph", "nitrogen", "phosphorus", "potassium", "temperature", "rainfall", "humidity", "area", "previous_yield"].includes(key) ? Number(value) : value }));
  };

  const getRecommendations = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true); setError(""); setYieldResult(null);
    try {
      const response = await fetch(apiUrl("/api/recommendations"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not calculate recommendations.");
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The recommendation service is unavailable.");
    } finally { setLoading(false); }
  };

  const forecast = async (crop: string) => {
    const payload = { ...form, crop };
    setYieldLoading(true); setError("");
    try {
      const response = await fetch(apiUrl("/api/yield"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not estimate yield.");
      setForm((current) => ({ ...current, crop }));
      setYieldResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The prediction service is unavailable.");
    } finally { setYieldLoading(false); }
  };

  return (
    <div className="dashboard-shell min-h-screen bg-[#f7f8f3] text-stone-800">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-stone-200 bg-white px-5 py-6 lg:flex">
          <Link to="/" className="mb-10 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-700 text-white"><Sprout className="h-6 w-6" /></span>
            <span><span className="block font-extrabold tracking-tight">Crop Recommendation</span><span className="text-xs text-stone-500">Agricultural decision support</span></span>
          </Link>
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">{tr("workspace")}</p>
          <nav className="space-y-1">
            <Link to="/" className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800"><Activity className="h-4 w-4" /> {tr("overview")}</Link>
            <a href="#recommend" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-stone-600 hover:bg-stone-50"><Wheat className="h-4 w-4" /> {tr("recommendationsNav")}</a>
            <Link to="/crop-disease" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-stone-600 hover:bg-stone-50"><Bug className="h-4 w-4" /> {tr("diseaseScan")}</Link>
            <a href="#profile" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-stone-600 hover:bg-stone-50"><Leaf className="h-4 w-4" /> {tr("farmerTools")}</a>
          </nav>
          <div className="mt-auto rounded-2xl bg-[#f4f6ed] p-4">
            <div className="mb-2 flex items-center gap-2 text-emerald-800"><CloudSun className="h-4 w-4" /><span className="text-xs font-bold">{tr("farmAdvisory")}</span></div>
            <p className="text-xs leading-5 text-stone-600">{tr("sidebarHelp")}</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
          <header className="mb-7 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white"><Sprout className="h-5 w-5" /></span><span className="font-bold">Crop Recommendation</span></div>
            <div className="hidden lg:block"><p className="text-sm text-stone-500">{tr("cropPlanning")}</p><h1 className="text-xl font-bold">Crop Recommendation System</h1></div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <label className="sr-only" htmlFor="pref-country">{tr("country")}</label>
              <select id="pref-country" aria-label={tr("country")} className="min-h-11 rounded-xl border border-stone-200 bg-white px-2 text-xs text-stone-700" value={settings.country} onChange={(event) => settings.setCountry(event.target.value)}>{COUNTRIES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select>
              <label className="sr-only" htmlFor="pref-language">{tr("language")}</label>
              <select id="pref-language" aria-label={tr("language")} className="min-h-11 rounded-xl border border-stone-200 bg-white px-2 text-xs text-stone-700" value={settings.language} onChange={(event) => settings.setLanguage(event.target.value as typeof settings.language)}>{UI_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.native}</option>)}</select>
              <button type="button" aria-label={`${tr("theme")}: ${settings.dark ? tr("dark") : tr("light")}`} onClick={() => settings.setDark(!settings.dark)} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700" title={tr("theme")}>{settings.dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
              <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600"><span className={`h-2 w-2 rounded-full ${apiReady ? "bg-emerald-500" : "bg-amber-400"}`} />{apiReady === null ? tr("modelStatusChecking") : apiReady ? tr("modelReady") : tr("modelOffline")}</div>
            </div>
          </header>

          <section className="relative mb-6 overflow-hidden rounded-[28px] bg-gradient-to-r from-[#174d37] via-[#216448] to-[#39794b] px-6 py-7 text-white sm:px-9 sm:py-9">
            <div className="relative z-10 max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-emerald-50"><Sparkles className="h-3.5 w-3.5" /> {tr("cropPlan")}</div>
              <h2 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{tr("heroTitle")}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/85">{tr("heroText")}</p>
              <div className="mt-5 flex flex-wrap gap-2"><a href="#recommend" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#e6bd61] px-4 py-3 text-sm font-bold text-emerald-950 transition hover:bg-[#f0cf7d]">{tr("heroButton")} <ArrowRight className="h-4 w-4" /></a><a href="#profile" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/60 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20"><Leaf className="h-4 w-4" />{tr("farmerTools")}</a></div>
            </div>
            <div className="pointer-events-none absolute -right-4 -top-20 hidden h-80 w-80 rounded-full border border-white/10 sm:block" />
            <div className="pointer-events-none absolute -right-1 -top-12 hidden h-64 w-64 rounded-full border border-white/10 sm:block" />
            <Leaf className="pointer-events-none absolute bottom-[-32px] right-12 hidden h-52 w-52 rotate-[-22deg] text-white/10 sm:block" />
          </section>

          <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard icon={<Wheat className="h-4 w-4" />} label={tr("cropsCompared")} value="8" detail={tr("seasons")} />
            <StatCard icon={<Activity className="h-4 w-4" />} label={tr("yieldModel")} value="Random Forest" detail={tr("trainedModel")} />
            <StatCard icon={<Shovel className="h-4 w-4" />} label={tr("soilFactors")} value="pH · N" detail={tr("ruleInputs")} />
            <StatCard icon={<CloudSun className="h-4 w-4" />} label={tr("climateFactors")} value="Temp · rain · season" detail={tr("ruleInputs")} />
          </section>

          <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)]">
            <section id="recommend" className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">{tr("cropPlanning")}</p><h2 className="mt-1 text-xl font-bold">{tr("tellFarm")}</h2><p className="mt-1 text-sm text-stone-500">{tr("compareHelp")}</p></div><span className="hidden h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 sm:flex"><MapPin className="h-5 w-5" /></span></div>
              <form onSubmit={getRecommendations} className="space-y-4">
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">{tr("replaceSamples")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={tr("state")}><input className={fieldClass} required value={form.state} onChange={(e) => change("state", e.target.value)} /></Field>
                  <Field label={tr("district")}><input className={fieldClass} required value={form.district} onChange={(e) => change("district", e.target.value)} /></Field>
                  <Field label={tr("soilType")}><select className={fieldClass} required value={form.soil_type} onChange={(e) => change("soil_type", e.target.value)}>{soils.map((item) => <option key={item}>{item}</option>)}</select></Field>
                  <Field label={tr("seasonLabel")}><select className={fieldClass} value={form.season} onChange={(e) => change("season", e.target.value)}>{seasons.map((item) => <option key={item}>{item}</option>)}</select></Field>
                </div>
                <div className="rounded-2xl bg-[#f7f8f3] p-4"><div className="mb-3 flex items-center gap-2 text-sm font-bold"><Shovel className="h-4 w-4 text-emerald-700" /> {tr("soilReadings")}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><NumberField label="pH" value={form.ph} step="0.1" max="14" onChange={(v) => change("ph", v)} /><NumberField label="Nitrogen" suffix="kg/ha" value={form.nitrogen} max="500" onChange={(v) => change("nitrogen", v)} /><NumberField label="Phosphorus" suffix="kg/ha" value={form.phosphorus} max="500" onChange={(v) => change("phosphorus", v)} /><NumberField label="Potassium" suffix="kg/ha" value={form.potassium} max="500" onChange={(v) => change("potassium", v)} /></div></div>
                <p className="-mt-2 px-1 text-xs leading-5 text-stone-500">{tr("measurementLimits")}</p>
                <div className="rounded-2xl bg-[#f7f8f3] p-4"><div className="mb-3 flex items-center gap-2 text-sm font-bold"><CloudSun className="h-4 w-4 text-emerald-700" /> {tr("climateFarm")}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><NumberField label={tr("temperature")} suffix="°C" value={form.temperature} min="-10" max="60" onChange={(v) => change("temperature", v)} /><NumberField label={tr("rainfall")} suffix="mm" value={form.rainfall} max="10000" onChange={(v) => change("rainfall", v)} /><NumberField label={tr("humidity")} suffix="%" value={form.humidity} max="100" onChange={(v) => change("humidity", v)} /><NumberField label={tr("farmArea")} suffix="ha" value={form.area} step="0.1" max="100000" onChange={(v) => change("area", v)} /></div></div>
                <div className="grid gap-3 sm:grid-cols-2"><Field label={tr("currentCrop")}><select className={fieldClass} value={form.crop} onChange={(e) => change("crop", e.target.value)}>{crops.map((item) => <option key={item}>{item}</option>)}</select></Field><NumberField label={tr("previousYield")} suffix="tons/ha" value={form.previous_yield} step="0.1" max="1000" onChange={(v) => change("previous_yield", v)} /></div>
                {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"><Sparkles className="h-4 w-4" />{loading ? tr("comparing") : tr("recommend")}</button>
                {apiReady === false && <p className="text-xs leading-5 text-amber-700">{tr("apiOffline")}</p>}
              </form>
            </section>

            <div className="space-y-5">
              <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Your crop shortlist</p><h2 className="mt-1 text-xl font-bold">Recommendations</h2></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Sprout className="h-5 w-5" /></span></div>
                {!result ? <div className="rounded-2xl border border-dashed border-stone-200 bg-[#fafbf8] px-5 py-8 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Wheat className="h-6 w-6" /></div><p className="font-semibold">Your recommendations will appear here</p><p className="mx-auto mt-1 max-w-xs text-sm leading-5 text-stone-500">Add your farm readings and compare eight crops for this season.</p></div> : <div className="space-y-3">{result.recommendations.map((item, index) => <div key={item.crop} className={`rounded-2xl border p-4 ${index === 0 ? "border-emerald-200 bg-emerald-50/70" : "border-stone-100 bg-white"}`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${index === 0 ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-600"}`}>{index + 1}</span><div><p className="font-bold">{item.crop}{index === 0 && <span className="ml-2 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Best fit</span>}</p><p className="mt-0.5 text-xs text-stone-500">{item.predicted_yield} tons/ha estimated · {item.suitability_score}% conditions fit</p></div></div><div className="text-right"><p className="text-lg font-extrabold text-emerald-800">{item.score}</p><p className="text-[10px] uppercase tracking-wide text-stone-400">match</p></div></div><div className="mt-3 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${item.score}%` }} /></div><button onClick={() => forecast(item.crop)} disabled={yieldLoading} className="shrink-0 text-xs font-semibold text-emerald-800 hover:underline">Estimate yield</button></div></div>)}</div>}
                {result && <div className="mt-4 rounded-2xl bg-[#f8f5ea] p-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-900">Why this crop?</p><ul className="space-y-1.5">{result.reasons.map((reason) => <li key={reason} className="flex gap-2 text-xs leading-5 text-stone-700"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />{reason}</li>)}</ul></div>}
              </section>

              {yieldResult && <section className="rounded-3xl bg-emerald-800 p-5 text-white shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">Yield forecast · {yieldResult.model}</p><h3 className="mt-2 text-2xl font-extrabold">{yieldResult.crop}</h3></div><span className="rounded-xl bg-white/10 p-2"><Wheat className="h-5 w-5" /></span></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/10 p-3"><p className="text-xs text-emerald-100">Per hectare</p><p className="mt-1 text-xl font-bold">{yieldResult.yield_per_hectare} <span className="text-xs font-medium">tons</span></p></div><div className="rounded-2xl bg-white/10 p-3"><p className="text-xs text-emerald-100">Whole farm · {yieldResult.area_hectares} ha</p><p className="mt-1 text-xl font-bold">{yieldResult.estimated_total_yield} <span className="text-xs font-medium">tons</span></p></div></div></section>}

              {result && <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Shovel className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Soil nutrition</p><h3 className="font-bold">Fertilizer starting points</h3></div></div><div className="mb-3 flex gap-2">{[["N", result.fertilizer.n_status], ["P", result.fertilizer.p_status], ["K", result.fertilizer.k_status]].map(([key, value]) => <span key={key} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">{key}: {value}</span>)}</div><ul className="space-y-2">{result.fertilizer.suggestions.map((suggestion) => <li key={suggestion} className="flex gap-2 text-sm leading-5 text-stone-600"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{suggestion}</li>)}</ul><p className="mt-3 text-[11px] leading-4 text-stone-400">Decision-support guidance only. Confirm fertilizer amounts with a local agriculture expert or soil test.</p></section>}

              <Link to="/crop-disease" className="group flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-emerald-300"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><Bug className="h-5 w-5" /></span><span><span className="block text-sm font-bold">Scan a crop</span><span className="text-xs text-stone-500">Check plant symptoms</span></span></div><ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700" /></Link>
            </div>
          </div>
          <FarmerWorkspace
            language={settings.language}
            countryCode={settings.country}
            onCountryCodeChange={settings.setCountry}
            recommendations={result?.recommendations ?? null}
            currentCrop={result?.recommended_crop ?? form.crop}
            currentAreaHa={form.area}
            onApplyProfile={(profile) => setForm((current) => ({
              ...current, state: profile.state, district: profile.district,
              soil_type: profile.soilType, ph: profile.ph, nitrogen: profile.nitrogen,
              phosphorus: profile.phosphorus, potassium: profile.potassium,
              area: areaInHectares(profile.area, profile.areaUnit),
              crop: profile.usualCrops[0] || current.crop,
            }))}
            onUpdateForm={(values) => setForm((current) => ({ ...current, ...values }))}
          />
          <p className="mt-7 flex items-center gap-2 text-[11px] text-stone-400"><Thermometer className="h-3.5 w-3.5" /><Droplets className="h-3.5 w-3.5" /> Recommendations combine crop suitability with bundled Random Forest yield estimates; results depend on the supplied farm information.</p>
          <footer className="mt-6 border-t border-stone-200 pt-4 text-center text-xs text-stone-400">Crop Recommendation System · Project by shivacharandhoni</footer>
        </main>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium text-stone-500">{label}</span><span className="text-emerald-700">{icon}</span></div><p className="text-lg font-extrabold tracking-tight text-stone-800">{value}</p><p className="mt-1 text-[11px] text-stone-400">{detail}</p></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className={labelClass}>{label}</span>{children}</label>;
}

function NumberField({ label, value, suffix, step = "1", min = "0", max, onChange }: { label: string; value: number; suffix?: string; step?: string; min?: string; max?: string; onChange: (value: string) => void }) {
  return <label className="block"><span className={labelClass}>{label}</span><div className="relative"><input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(event.target.value)} className={`${fieldClass} ${suffix ? "pr-14" : ""}`} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-stone-400">{suffix}</span></div></label>;
}
