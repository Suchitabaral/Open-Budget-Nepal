import { cn } from "@/lib/utils";

export type ChatMessageData = {
  id: string;
  role: "user" | "assistant";
  content: React.ReactNode;
};

export default function ChatMessage({ message }: { message: ChatMessageData }) {
  const isUser = message.role === "user";

  return <article className={cn("flex", isUser ? "justify-end" : "justify-start")}>
    <div className={cn("min-w-0", isUser ? "max-w-[85%] sm:max-w-[68%]" : "max-w-[92%] sm:max-w-[84%]")}>
      <p className={cn("mb-1.5 text-xs font-medium", isUser ? "text-right text-slate-500 dark:text-slate-400" : "text-slate-600 dark:text-slate-300")}>{isUser ? "You" : "Open Budget Assistant"}</p>
      <div className={cn("rounded-xl border px-4 py-3 text-sm leading-6", isUser ? "border-emerald-200 bg-emerald-50 text-slate-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-slate-100" : "border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200")}>
        {message.content}
      </div>
    </div>
  </article>;
}
