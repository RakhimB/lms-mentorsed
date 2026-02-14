"use client";

import * as React from "react";
import axios from "axios";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MiniMarkdown } from "@/components/ai/mini-markdown";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  suggestions?: Array<{ label: string; question: string }>;
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
      suggestions: [
        {
          label: "What is this lesson about?",
          question: `What is this lesson “${chapterTitle}” about? Give me a short overview.`,
        },
        {
          label: "Key concepts",
          question: `What are the key concepts covered in “${chapterTitle}”?`,
        },
        {
          label: "Explain with examples",
          question: `Explain the main idea of “${chapterTitle}” with a simple example.`,
        },
        {
          label: "Common mistakes",
          question: `What common mistakes do learners make in this lesson “${chapterTitle}” and how to avoid them?`,
        },
      ],
    },
  ]);

  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  // Auto-scroll to newest message
  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // Load history
  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get("/api/ai/chat", {
          params: { courseId, chapterId },
        });

        if (Array.isArray(res.data?.messages) && res.data.messages.length > 0) {
          setMessages(res.data.messages);
        }
      } catch {
        // ignore
      }
    };
    load();
  }, [courseId, chapterId]);

  const enqueueUserQuestion = async (question: string) => {
    const trimmed = (question ?? "").trim();
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
        {
          role: "assistant",
          content: res.data.reply,
          suggestions: Array.isArray(res.data.suggestions)
            ? res.data.suggestions
            : undefined,
        },
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

  const send = async () => enqueueUserQuestion(input);

  const renderSuggestions = (s?: ChatMessage["suggestions"]) => {
    const list = (s && s.length ? s : undefined) ?? [
      {
        label: "Overview",
        question: `Give me a short overview of “${chapterTitle}”.`,
      },
      {
        label: "Key concept",
        question: `Explain the most important concept in “${chapterTitle}” in simple terms.`,
      },
      {
        label: "Example",
        question: `Give me a practical example from “${chapterTitle}”.`,
      },
    ];

    return (
      <div className="mt-2">
        <div className="text-xs text-muted-foreground">
          What you want to know next?
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {list.map((x, i) => (
            <button
              key={i}
              type="button"
              onClick={() => enqueueUserQuestion(x.question)}
              disabled={loading}
              className="text-left"
            >
              <Badge variant="outline" className="cursor-pointer select-none">
                {x.label}
              </Badge>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // show suggestions only under the latest assistant message
  const lastAssistantIndex = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "assistant") return i;
    }
    return -1;
  }, [messages]);

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
        {messages.map((m, idx) => {
          const showSuggestions =
            m.role === "assistant" && idx === lastAssistantIndex;

          return (
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
                {m.role === "assistant" ? (
                  <div>
                    <MiniMarkdown content={m.content} />
                    {showSuggestions ? renderSuggestions(m.suggestions) : null}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}
              </div>
            </div>
          );
        })}

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
