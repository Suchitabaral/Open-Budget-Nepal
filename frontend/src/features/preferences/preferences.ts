export const PREFERENCES_STORAGE_KEY = "open-budget-nepal:preferences";
export const PREFERENCES_VERSION = 1 as const;

export type Language = "en" | "ne";
export type ThemePreference = "system" | "light" | "dark";
export type Preferences = { version: typeof PREFERENCES_VERSION; language: Language; theme: ThemePreference };

export const DEFAULT_PREFERENCES: Preferences = { version: PREFERENCES_VERSION, language: "en", theme: "system" };
const languages = new Set<Language>(["en", "ne"]);
const themes = new Set<ThemePreference>(["system", "light", "dark"]);

export function parsePreferences(value: string | null): Preferences {
  if (!value) return { ...DEFAULT_PREFERENCES };
  try {
    const candidate = JSON.parse(value) as Partial<Preferences>;
    if (candidate.version !== PREFERENCES_VERSION || !languages.has(candidate.language as Language) || !themes.has(candidate.theme as ThemePreference)) return { ...DEFAULT_PREFERENCES };
    return candidate as Preferences;
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function loadPreferences(storage?: Pick<Storage, "getItem">): Preferences {
  if (!storage) return { ...DEFAULT_PREFERENCES };
  return parsePreferences(storage.getItem(PREFERENCES_STORAGE_KEY));
}

export function savePreferences(preferences: Preferences, storage?: Pick<Storage, "setItem">) {
  storage?.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

export function resolvedTheme(theme: ThemePreference, systemIsDark: boolean): "light" | "dark" {
  return theme === "system" ? (systemIsDark ? "dark" : "light") : theme;
}

export function getToggledTheme(theme: ThemePreference, systemIsDark: boolean): "light" | "dark" {
  return resolvedTheme(theme, systemIsDark) === "dark" ? "light" : "dark";
}

export function applyTheme(theme: ThemePreference, root: Pick<HTMLElement, "classList" | "style">, systemIsDark: boolean) {
  const active = resolvedTheme(theme, systemIsDark);
  root.classList.toggle("dark", active === "dark");
  root.style.colorScheme = active;
}

export function applyLanguage(language: Language, root: Pick<HTMLElement, "lang">) {
  root.lang = language === "ne" ? "ne" : "en";
}

export function initializePreferences() {
  const preferences = loadPreferences(window.localStorage);
  applyTheme(preferences.theme, document.documentElement, window.matchMedia("(prefers-color-scheme: dark)").matches);
  applyLanguage(preferences.language, document.documentElement);
  return preferences;
}
