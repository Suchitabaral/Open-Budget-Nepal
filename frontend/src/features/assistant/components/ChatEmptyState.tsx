import { useTranslation } from "@/features/preferences/translations";

export default function ChatEmptyState({ prompts, onSelect }: { prompts: string[]; onSelect: (prompt: string) => void }) {
  const t = useTranslation();

  return <div className="flex min-h-[18rem] flex-1 items-center justify-center px-4 py-10 text-center sm:px-8">
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{t("chatEmptyTitle")}</h2>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {prompts.map(prompt => <button key={prompt} type="button" onClick={() => onSelect(prompt)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950 dark:hover:text-emerald-200">{prompt}</button>)}
      </div>
    </div>
  </div>;
}
