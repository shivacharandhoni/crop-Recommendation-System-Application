import { useEffect, useState } from "react";
import type { UiLanguage } from "@/lib/farmerLocale";

const languageKey = "crop-recommendation-ui-language";
const countryKey = "crop-recommendation-country";
const themeKey = "crop-recommendation-theme";

export function useFarmerSettings() {
  const [language, setLanguageState] = useState<UiLanguage>(() => {
    const value = localStorage.getItem(languageKey);
    return value === "hi" || value === "te" ? value : "en";
  });
  const [country, setCountryState] = useState(() => localStorage.getItem(countryKey) || "IN");
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem(themeKey);
    return saved ? saved === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    const apply = (value: boolean) => { document.documentElement.classList.toggle("dark", value); setDark(value); };
    const saved = localStorage.getItem(themeKey);
    if (saved) { apply(saved === "dark"); return; }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    apply(media.matches);
    const onChange = (event: MediaQueryListEvent) => apply(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [dark]);
  const chooseDark = (value: boolean) => { localStorage.setItem(themeKey, value ? "dark" : "light"); setDark(value); };
  const setLanguage = (value: UiLanguage) => { setLanguageState(value); localStorage.setItem(languageKey, value); };
  const setCountry = (value: string) => { setCountryState(value); localStorage.setItem(countryKey, value); };
  return { language, setLanguage, country, setCountry, dark, setDark: chooseDark };
}
