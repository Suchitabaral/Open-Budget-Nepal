import { createContext, useContext } from "react";
import type { Language, Preferences, ThemePreference } from "./preferences";

export type PreferencesContextValue = {
  preferences: Preferences;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemePreference) => void;
  reset: () => void;
};

export const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider.");
  return value;
}
