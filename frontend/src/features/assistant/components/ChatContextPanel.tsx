import { useTranslation } from "@/features/preferences/translations";

function ContextContent() {
  const t = useTranslation();
  return <div className="space-y-5">
    <div><h3 className="text-xs font-semibold text-slate-950 dark:text-white">{t("chatSources")}</h3><p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{t("chatNoSources")}</p></div>
    <div className="border-t border-slate-200 pt-5 dark:border-slate-700"><h3 className="text-xs font-semibold text-slate-950 dark:text-white">{t("chatConversation")}</h3><p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{t("chatNewConversation")}</p></div>
    <div className="border-t border-slate-200 pt-5 dark:border-slate-700"><h3 className="text-xs font-semibold text-slate-950 dark:text-white">{t("chatScope")}</h3><ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-300"><li>{t("budgets")}</li><li>{t("projects")}</li><li>{t("procurement")}</li><li>{t("contractors")}</li></ul></div>
  </div>;
}

export function ChatContextPanel() {
  const t = useTranslation();
  return <aside aria-labelledby="chat-context-title" className="absolute right-4 top-4 z-20 hidden w-72 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:block">
    <h2 id="chat-context-title" className="mb-5 text-sm font-semibold text-slate-950 dark:text-white">{t("chatContext")}</h2><ContextContent />
  </aside>;
}

export function MobileChatContext() {
  const t = useTranslation();
  return <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:hidden">
    <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 dark:text-slate-100">{t("viewChatContext")}</summary>
    <div className="border-t border-slate-200 p-4 dark:border-slate-700"><ContextContent /></div>
  </details>;
}
