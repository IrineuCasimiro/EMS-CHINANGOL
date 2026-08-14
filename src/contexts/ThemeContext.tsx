import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Language } from '@/lib/constants';
import { TRANSLATIONS } from '@/lib/constants';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('ems-theme') as Theme | null;
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('ems-lang') as Language | null;
    return stored === 'zh' ? 'zh' : 'en';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('ems-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('ems-lang', language);
  }, [language]);

  const toggleTheme = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  const setTheme = (t: Theme) => setThemeState(t);
  const setLanguage = (l: Language) => setLanguageState(l);
  const toggleLanguage = () => setLanguageState((l) => (l === 'en' ? 'zh' : 'en'));
  const t = (key: string): string => TRANSLATIONS[language][key] ?? key;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, language, setLanguage, toggleLanguage, t }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
