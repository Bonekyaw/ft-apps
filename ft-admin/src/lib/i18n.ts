import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import my from "@/locales/my.json";

const STORAGE_KEY = "ft-admin-lang";

function getSavedLanguage(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "en";
  } catch {
    return "en";
  }
}

/** Keep <html lang="…"> in sync so CSS can target the active language. */
function syncHtmlLang(lng: string) {
  document.documentElement.lang = lng;
}

const savedLng = getSavedLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    my: { translation: my },
  },
  lng: savedLng,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Set the initial lang attribute
syncHtmlLang(savedLng);

// Keep it updated on every language change
i18n.on("languageChanged", syncHtmlLang);

/** Switch language and persist to localStorage. */
export function changeLanguage(lng: "en" | "my") {
  localStorage.setItem(STORAGE_KEY, lng);
  i18n.changeLanguage(lng);
}

export default i18n;
