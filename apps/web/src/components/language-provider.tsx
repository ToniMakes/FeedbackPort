"use client";

import { createContext, useContext, type ReactNode } from "react";
import { UI_COPY, type Locale } from "@/lib/ui-copy";

const LanguageContext = createContext<Locale>("en");

export function LanguageProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LanguageContext.Provider value={locale}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const locale = useContext(LanguageContext);
  return { locale, copy: UI_COPY[locale] };
}
