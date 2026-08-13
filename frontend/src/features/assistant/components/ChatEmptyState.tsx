import { useTranslation } from "@/features/preferences/translations";

export default function ChatEmptyState() {
  const t = useTranslation();

  return <div className="flex min-h-[18rem] flex-1 items-center justify-center px-4 py-10 text-center sm:px-8">
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{t("chatEmptyTitle")}</h2>
    </div>
  </div>;
}
