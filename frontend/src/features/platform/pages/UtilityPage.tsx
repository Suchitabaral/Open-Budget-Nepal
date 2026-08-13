import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePreferences } from "@/features/preferences/context";
import { useTranslation } from "@/features/preferences/translations";
import type { Language, ThemePreference } from "@/features/preferences/preferences";
import { cn } from "@/lib/utils";

const themes: ThemePreference[] = ["system", "light", "dark"];

export default function UtilityPage() {
  const { preferences, setLanguage, setTheme, reset } = usePreferences();
  const t = useTranslation();

  return <Layout><div className="w-full">
    <header className="border-b border-slate-200 pb-6 dark:border-slate-800">
      <h1 className="text-2xl font-bold tracking-[-.025em] text-slate-950 dark:text-white sm:text-[28px]">{t("settings")}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-[15px]">{t("settingsIntro")}</p>
    </header>

    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      <section className="grid gap-4 py-7 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-start sm:gap-10" aria-labelledby="language-heading">
        <div><h2 id="language-heading" className="text-sm font-semibold text-slate-950 dark:text-white">{t("language")}</h2><p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">{t("languageHelp")}</p></div>
        <Select value={preferences.language} onValueChange={value => setLanguage(value as Language)}>
          <SelectTrigger aria-label={t("language")} className="dark:border-slate-700 dark:bg-slate-900 dark:text-white"><SelectValue /></SelectTrigger>
          <SelectContent className="dark:border-slate-700 dark:bg-slate-900 dark:text-white"><SelectItem value="en">{t("english")}</SelectItem><SelectItem value="ne">{t("nepali")}</SelectItem></SelectContent>
        </Select>
      </section>

      <fieldset className="grid gap-4 py-7 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-start sm:gap-10">
        <div><legend className="text-sm font-semibold text-slate-950 dark:text-white">{t("appearance")}</legend><p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">{t("appearanceHelp")}</p></div>
        <div className="grid grid-cols-3 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900" role="radiogroup" aria-label={t("appearance")}>
          {themes.map(theme => <button key={theme} type="button" role="radio" aria-checked={preferences.theme === theme} onClick={() => setTheme(theme)} className={cn("h-9 rounded-md px-2 text-sm font-medium text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:text-slate-300 dark:ring-offset-slate-900", preferences.theme === theme && "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white")}>{t(theme)}</button>)}
        </div>
      </fieldset>

      <section className="flex flex-col gap-4 py-7 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="reset-heading">
        <div><h2 id="reset-heading" className="text-sm font-semibold text-slate-950 dark:text-white">{t("resetPreferences")}</h2><p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">{t("resetHelp")}</p></div>
        <Button type="button" variant="outline" onClick={reset} className="self-start dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:self-auto">{t("resetToDefaults")}</Button>
      </section>
    </div>
  </div></Layout>;
}
