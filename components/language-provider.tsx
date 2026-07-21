'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { translations, type Locale, type Translation } from '@/lib/i18n';

type LangContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translation;
};

const LangContext = createContext<LangContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('ru');
  const t = translations[locale];
  return (
    <LangContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
