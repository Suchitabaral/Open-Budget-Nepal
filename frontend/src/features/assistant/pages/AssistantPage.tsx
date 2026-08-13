import { useState } from "react";
import Layout from "@/components/layout/Layout";
import PageHeader from "@/components/layout/PageHeader";
import ChatComposer from "@/features/assistant/components/ChatComposer";
import { ChatContextPanel, MobileChatContext } from "@/features/assistant/components/ChatContextPanel";
import ChatEmptyState from "@/features/assistant/components/ChatEmptyState";
import ChatMessage, { type ChatMessageData } from "@/features/assistant/components/ChatMessage";
import { useTranslation } from "@/features/preferences/translations";

export default function AssistantPage() {
  const t = useTranslation();
  const [input, setInput] = useState("");
  const messages: ChatMessageData[] = [];
  const hasConversation = messages.length > 0;
  const prompts = [t("chatPromptBudgets"), t("chatPromptProjects"), t("chatPromptContractors"), t("chatPromptWatchdog")];

  return <Layout>
    <PageHeader title={t("chatTitle")} subtitle={t("chatIntro")} />
    {hasConversation ? <div className="mb-4"><MobileChatContext /></div> : null}
    <div className="relative">
      <section aria-label={t("chatConversation")} className="flex min-h-[calc(100dvh-13rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:min-h-[calc(100dvh-12rem)]">
        <div className="flex flex-1 flex-col space-y-7 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {messages.length === 0 ? <ChatEmptyState prompts={prompts} onSelect={setInput} /> : messages.map(message => <ChatMessage key={message.id} message={message} />)}
        </div>
        <ChatComposer value={input} onChange={setInput} />
      </section>
      {hasConversation ? <ChatContextPanel /> : null}
    </div>
  </Layout>;
}
