import { useEffect, useState } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, Moon, Sun } from "lucide-react";
import { usePreferences } from "@/features/preferences/context";
import { getToggledTheme, resolvedTheme, type Language } from "@/features/preferences/preferences";
import { useTranslation } from "@/features/preferences/translations";

export default function QuickPreferences() {
  const { preferences, setLanguage, setTheme } = usePreferences();
  const t = useTranslation();
  const [systemIsDark, setSystemIsDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemIsDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const activeTheme = resolvedTheme(preferences.theme, systemIsDark);
  const switchingToDark = activeTheme === "light";

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label={t("quickPreferences")}>
      <Select.Root
        value={preferences.language}
        onValueChange={(value) => setLanguage(value as Language)}
      >
        <Select.Trigger
          aria-label={t("selectLanguage")}
          className="flex h-9 min-w-16 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <Select.Value>{preferences.language === "en" ? "ENG" : "NEP"}</Select.Value>
          <Select.Icon asChild>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            align="end"
            className="z-50 min-w-32 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 text-slate-900 shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <Select.Viewport>
              {([
                ["en", t("english")],
                ["ne", t("nepali")],
              ] as const).map(([value, label]) => (
                <Select.Item
                  key={value}
                  value={value}
                  className="relative flex h-9 cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-3 text-sm outline-none data-[highlighted]:bg-emerald-50 data-[highlighted]:text-emerald-900 dark:data-[highlighted]:bg-emerald-950 dark:data-[highlighted]:text-emerald-100"
                >
                  <span className="absolute left-2.5 grid h-4 w-4 place-items-center">
                    <Select.ItemIndicator><Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" /></Select.ItemIndicator>
                  </span>
                  <Select.ItemText>{label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      <button
        type="button"
        aria-label={switchingToDark ? t("switchToDarkMode") : t("switchToLightMode")}
        title={switchingToDark ? t("switchToDarkMode") : t("switchToLightMode")}
        onClick={() => setTheme(getToggledTheme(preferences.theme, systemIsDark))}
        className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        {switchingToDark ? <Moon className="h-[18px] w-[18px]" aria-hidden="true" /> : <Sun className="h-[18px] w-[18px]" aria-hidden="true" />}
      </button>
    </div>
  );
}
