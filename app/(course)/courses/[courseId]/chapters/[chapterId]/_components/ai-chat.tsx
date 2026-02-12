"use client";

import * as React from "react";
import axios from "axios";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function AiChat({
  courseId,
  chapterId,
  chapterTitle,
}: {
  courseId: string;
  chapterId: string;
  chapterTitle: string;
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hi! Ask me anything about “${chapterTitle}”. I’ll explain step-by-step and can give examples.`,
    },
  ]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  
  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get("/api/ai/chat", {
          params: { courseId, chapterId },
        });

        if (Array.isArray(res.data?.messages) && res.data.messages.length > 0) {
          setMessages(res.data.messages);
        }
      } catch (e: any) {
        // ignore silently (e.g., not purchased yet)
      }
    };
    load();
  }, [courseId, chapterId]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setInput("");
    setLoading(true);

    // Optimistic UI
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

    try {
      const res = await axios.post("/api/ai/chat", {
        courseId,
        chapterId,
        message: trimmed,
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.reply },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            e?.response?.data?.error ??
            "Sorry—something went wrong while generating an answer. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };


  return (
    <Card className="mt-6 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">AI Tutor</h3>
          <p className="text-sm text-muted-foreground">
            Ask questions about this lesson and get explanations + examples.
          </p>
        </div>
      </div>

      <div
        ref={listRef}
        className="mt-4 h-72 overflow-y-auto rounded-md border bg-white/40 p-3 space-y-3"
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 text-slate-900"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
              Thinking…
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
          className="min-h-[44px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button onClick={send} disabled={loading || !input.trim()}>
          Send
        </Button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Tip: Press <span className="font-medium">Enter</span> to send,{" "}
        <span className="font-medium">Shift+Enter</span> for a new line.
      </p>
    </Card>
  );
}
