import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Sparkles, Lightbulb } from "lucide-react";
import Layout from "@/components/layout/Layout";
import PageHeader from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const suggestedQuestions = [
  "Show education budget trends.",
  "Compare capital expenditure.",
  "Explain fiscal deficit.",
  "What is the utilization rate?",
];

const mockResponses: Record<string, string> = {
  "Show education budget trends.":
    "Education budget has grown from NPR 145.2B in FY 2080/81 to NPR 245.3B in FY 2081/82, marking a 68.9% increase. The sector now represents 18.5% of total capital and recurrent expenditure.",
  "Compare capital expenditure.":
    "Capital expenditure for FY 2081/82 stands at NPR 794.2B (24.1% of total spending), up from NPR 620.5B last fiscal year. Major allocations include infrastructure (26.9%), energy (11.8%), and health (15.0%).",
  "Explain fiscal deficit.":
    "The fiscal deficit occurs when government expenditure exceeds revenue. For FY 2081/82, Nepal's deficit is NPR 1,448.1B, financed primarily through domestic borrowing (NPR 598.1B) and foreign grants/loans (NPR 169.8B).",
  "What is the utilization rate?":
    "The utilization rate for FY 2081/82 is 88.6%, down 1.4% from FY 2080/81. This means NPR 3,295.3B out of the budgeted NPR 3,720.6B has been spent so far.",
};

const defaultResponse =
  "I'm analyzing the budget data for you. Based on the latest fiscal records, total budgeted amount for FY 2081/82 is NPR 3,720.6B with a utilization rate of 88.6%. Would you like me to dive deeper into revenue, expenditure, or watchdog findings?";

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your Government Budget AI Assistant. Ask me anything about Nepal's federal budget, fiscal trends, or suspicious procurement activity.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const responseText = mockResponses[text] || defaultResponse;
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: responseText,
      timestamp: new Date(),
    };

    setIsTyping(false);
    setMessages((prev) => [...prev, assistantMessage]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  return (
    <Layout>
      <PageHeader
        title="Government Budget AI Assistant"
        subtitle="Ask questions about budgets, fiscal trends, and procurement anomalies."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-240px)] min-h-[500px]">
        {/* Sidebar with suggestions */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="hidden lg:block lg:col-span-1"
        >
          <Card className="border-none shadow-md h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Suggested Questions</h3>
              </div>
              <div className="space-y-2">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSend(question)}
                    className="w-full text-left p-3 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors border border-transparent hover:border-border"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Chat Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:col-span-3 flex flex-col h-full"
        >
          <Card className="border-none shadow-md flex-1 flex flex-col overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-3 ${
                      message.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent text-accent-foreground"
                      }`}
                    >
                      {message.role === "user" ? (
                        <User className="h-5 w-5" />
                      ) : (
                        <Bot className="h-5 w-5" />
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted text-foreground rounded-tl-sm"
                      }`}
                    >
                      {message.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Mobile Suggestions */}
            <div className="lg:hidden px-4 pb-2 flex gap-2 overflow-x-auto">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  onClick={() => handleSend(question)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs bg-accent text-accent-foreground whitespace-nowrap"
                >
                  {question}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border bg-white">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about budget trends, expenditure, or procurement anomalies..."
                    className="pl-9 bg-white"
                  />
                </div>
                <Button type="submit" disabled={!input.trim() || isTyping}>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </form>
            </div>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
