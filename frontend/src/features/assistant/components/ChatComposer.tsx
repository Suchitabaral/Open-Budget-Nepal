import { ArrowUp } from "lucide-react";
import { useTranslation } from "@/features/preferences/translations";

export default function ChatComposer({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslation();

  return <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 sm:p-4">
    <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-900">
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={1}
        aria-label={t("chatInputLabel")}
        placeholder={t("chatInputPlaceholder")}
        className="h-10 min-h-10 flex-1 resize-none appearance-none overflow-y-auto border-0 bg-transparent px-2 py-2.5 text-sm leading-5 text-slate-950 outline-none focus-visible:outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-400"
      />
      <button type="button" disabled aria-label={t("sendMessage")} className="grid h-10 w-10 shrink-0 cursor-not-allowed place-items-center rounded-lg bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
    </div>
  </div>;
}
