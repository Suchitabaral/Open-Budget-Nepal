import assert from "node:assert/strict";
import test from "node:test";
import { applyLanguage, applyTheme, DEFAULT_PREFERENCES, loadPreferences, parsePreferences, PREFERENCES_STORAGE_KEY, resolvedTheme, savePreferences, type Preferences } from "./preferences.ts";

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), value: (key: string) => values.get(key) };
}

test("defaults and malformed storage safely use English and system appearance", () => {
  assert.deepEqual(loadPreferences(storage()), DEFAULT_PREFERENCES);
  assert.deepEqual(parsePreferences("not-json"), DEFAULT_PREFERENCES);
  assert.deepEqual(parsePreferences('{"version":1,"language":"fr","theme":"night"}'), DEFAULT_PREFERENCES);
});

test("language change is persisted and immediately applied", () => {
  const store = storage(); const preferences: Preferences = { version: 1, language: "ne", theme: "system" }; const root = { lang: "en" };
  savePreferences(preferences, store); applyLanguage(preferences.language, root);
  assert.equal(loadPreferences(store).language, "ne"); assert.equal(root.lang, "ne");
});

test("light, dark and system themes resolve and apply", () => {
  const classes = new Set<string>(); const root = { classList: { toggle: (name: string, active: boolean) => active ? classes.add(name) : classes.delete(name) }, style: { colorScheme: "" } };
  applyTheme("dark", root, false); assert.equal(classes.has("dark"), true); assert.equal(root.style.colorScheme, "dark");
  applyTheme("light", root, true); assert.equal(classes.has("dark"), false); assert.equal(root.style.colorScheme, "light");
  assert.equal(resolvedTheme("system", true), "dark"); assert.equal(resolvedTheme("system", false), "light");
});

test("theme persists and reset writes only the application preference key", () => {
  const store = storage({ unrelated: "keep" });
  savePreferences({ version: 1, language: "en", theme: "dark" }, store);
  assert.equal(loadPreferences(store).theme, "dark");
  savePreferences(DEFAULT_PREFERENCES, store);
  assert.deepEqual(JSON.parse(store.value(PREFERENCES_STORAGE_KEY)!), DEFAULT_PREFERENCES);
  assert.equal(store.value("unrelated"), "keep");
});
