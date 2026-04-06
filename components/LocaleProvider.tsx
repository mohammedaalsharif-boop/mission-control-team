"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import en from "@/lib/i18n/en";
import ar from "@/lib/i18n/ar";
import type { Translations } from "@/lib/i18n/en";

type Locale = "en" | "ar";

interface LocaleContextType {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
  dir: "ltr" | "rtl";
  isRTL: boolean;
}

const LOCALE_KEY = "mc_locale";

const translations: Record<Locale, Translations> = { en, ar };

const LocaleContext = createContext<LocaleContextType>({
  locale: "en",
  t: en,
  setLocale: () => {},
  dir: "ltr",
  isRTL: false,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LOCALE_KEY);
      if (stored === "ar" || stored === "en") return stored;
    }
    return "en";
  });

  const t = translations[locale];

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LOCALE_KEY, newLocale);
  }, []);

  // Sync <html> attributes when locale changes
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("dir", t.dir);
    html.setAttribute("lang", t.locale);
  }, [t.dir, t.locale]);

  return (
    <LocaleContext.Provider value={{
      locale,
      t,
      setLocale,
      dir: t.dir as "ltr" | "rtl",
      isRTL: t.dir === "rtl",
    }}>
      {children}
    </LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);
