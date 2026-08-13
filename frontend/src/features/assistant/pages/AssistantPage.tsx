import { useRef, useState } from "react";
import Layout from "@/components/layout/Layout";
import PageHeader from "@/components/layout/PageHeader";
import ChatComposer from "@/features/assistant/components/ChatComposer";
import { ChatContextPanel, MobileChatContext } from "@/features/assistant/components/ChatContextPanel";
import ChatEmptyState from "@/features/assistant/components/ChatEmptyState";
import ChatMessage, { type ChatMessageData } from "@/features/assistant/components/ChatMessage";
import { useTranslation } from "@/features/preferences/translations";
import { askBudgetAssistant, type ChatSource } from "@/features/assistant/api/chatApi";

export default function AssistantPage() {
  const t = useTranslation();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  const hasConversation = messages.length > 0;
  const prompts = [t("chatPromptBudgets"), t("chatPromptProjects"), t("chatPromptContractors"), t("chatPromptWatchdog")];

  const send = async () => {
    const query = input.trim();
    if (!query || pending) return;
    const userId = `message-${nextId.current++}`;
    const assistantId = `message-${nextId.current++}`;
    setInput("");
    setPending(true);
    setMessages(current => [...current, { id: userId, role: "user", content: query }, { id: assistantId, role: "assistant", content: t("chatThinking"), status: "pending" }]);
    try {
      const response = await askBudgetAssistant(query);
      setMessages(current => current.map(message => message.id === assistantId ? { ...message, content: response.content, status: "complete" } : message));
      setSources(response.sources);
    } catch (error) {
      const detail = error instanceof Error ? error.message : t("chatRequestFailed");
      setMessages(current => current.map(message => message.id === assistantId ? { ...message, content: `${t("chatRequestFailed")} ${detail}`, status: "error" } : message));
      setSources([]);
    } finally {
      setPending(false);
    }
  };

  return <Layout>
    <PageHeader title={t("chatTitle")} subtitle={t("chatIntro")} />
    {hasConversation ? <div className="mb-4"><MobileChatContext sources={sources} /></div> : null}
    <div className="relative">
      <section aria-label={t("chatConversation")} className="flex min-h-[calc(100dvh-13rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:min-h-[calc(100dvh-12rem)]">
        <div className="flex flex-1 flex-col space-y-7 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {messages.length === 0 ? <ChatEmptyState prompts={prompts} onSelect={setInput} /> : messages.map(message => <ChatMessage key={message.id} message={message} />)}
        </div>
        <ChatComposer value={input} onChange={setInput} onSubmit={send} pending={pending} />
      </section>
      {hasConversation ? <ChatContextPanel sources={sources} /> : null}
    </div>
  </Layout>;
}
