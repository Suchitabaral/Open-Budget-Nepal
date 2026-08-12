import { useEffect, useMemo, useState, type ReactNode } from "react";
import { applyLanguage, applyTheme, DEFAULT_PREFERENCES, savePreferences, type Preferences } from "./preferences";
import { PreferencesContext, type PreferencesContextValue } from "./context";

export function PreferencesProvider({ children, initialPreferences }: { children: ReactNode; initialPreferences: Preferences }) {
  const [preferences, setPreferences] = useState(initialPreferences);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => applyTheme(preferences.theme, document.documentElement, media.matches);
    apply();
    applyLanguage(preferences.language, document.documentElement);
    savePreferences(preferences, window.localStorage);
    if (preferences.theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preferences]);

  const value = useMemo<PreferencesContextValue>(() => ({
    preferences,
    setLanguage: language => setPreferences(current => ({ ...current, language })),
    setTheme: theme => setPreferences(current => ({ ...current, theme })),
    reset: () => setPreferences({ ...DEFAULT_PREFERENCES }),
  }), [preferences]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
