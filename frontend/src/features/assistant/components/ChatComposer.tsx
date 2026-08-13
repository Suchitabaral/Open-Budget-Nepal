import { ArrowUp } from "lucide-react";
import { useTranslation } from "@/features/preferences/translations";

export default function ChatComposer({ value, onChange, onSubmit, pending }: { value: string; onChange: (value: string) => void; onSubmit: () => void; pending: boolean }) {
  const t = useTranslation();

  return <form onSubmit={event => { event.preventDefault(); onSubmit(); }} className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 sm:p-4">
    <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-900">
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={1}
        aria-label={t("chatInputLabel")}
        placeholder={t("chatInputPlaceholder")}
        disabled={pending}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(); } }}
        className="h-10 min-h-10 flex-1 resize-none appearance-none overflow-y-auto border-0 bg-transparent px-2 py-2.5 text-sm leading-5 text-slate-950 outline-none focus-visible:outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-400"
      />
      <button type="submit" disabled={pending || !value.trim()} aria-label={pending ? t("chatSending") : t("sendMessage")} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-700 text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
    </div>
  </form>;
}
