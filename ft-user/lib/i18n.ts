import * as Localization from "expo-localization";
import { I18n } from "i18n-js";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "@/locales/en.json";
import my from "@/locales/my.json";

export type LocaleCode = "en" | "my";

const STORAGE_KEY = "app_locale";

const i18n = new I18n({ en, my });
i18n.enableFallback = true;
i18n.defaultLocale = "en";

function getDeviceLocale(): LocaleCode {
  const codes = Localization.getLocales();
  const preferred = codes?.[0]?.languageCode;
  if (preferred === "my" || preferred === "en") return preferred;
  return "en";
}

interface LocaleState {
  locale: LocaleCode;
  isHydrated: boolean;
  setLocale: (code: LocaleCode) => void;
  hydrate: () => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "en",
      isHydrated: false,
      setLocale(code: LocaleCode) {
        i18n.locale = code;
        set({ locale: code });
      },
      hydrate() {
        const device = getDeviceLocale();
        i18n.locale = device;
        set({ locale: device, isHydrated: true });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ locale: s.locale }),
      onRehydrateStorage: () => (state) => {
        if (state?.locale) {
          i18n.locale = state.locale;
        }
        // Mark hydrated after rehydration so we can apply stored locale
        useLocaleStore.setState({ isHydrated: true });
      },
    }
  )
);

/**
 * Translate a key. Supports nested keys (e.g. 'auth.signIn.title') and interpolation (e.g. 'resendIn' with {{count}}).
 */
export function t(
  key: string,
  options?: Record<string, string | number>
): string {
  return i18n.t(key, options as Record<string, unknown>) as string;
}

export function getLocale(): LocaleCode {
  return (i18n.locale as LocaleCode) ?? "en";
}

export function setLocale(code: LocaleCode): void {
  i18n.locale = code;
  useLocaleStore.getState().setLocale(code);
}

export { i18n };

/** Hook for translations and locale. Components re-render when locale changes. */
export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  return {
    t: (key: string, options?: Record<string, string | number>) =>
      i18n.t(key, options as Record<string, unknown>) as string,
    locale,
    setLocale: useLocaleStore.getState().setLocale,
  };
}
