import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { getOrBuildChapterLessonSummary } from "@/lib/chapter-lesson-summary";
import { checkRateLimit } from "@/lib/rate-limit";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");
  return new OpenAI({ apiKey });
}

const CHEAP_MODEL = "gpt-4o-mini";

function safeParseJson(text: string): any | null {
  const raw = (text ?? "").trim();
  if (!raw) return null;

  // strip code fences if model wraps output
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function systemPrompt({
  courseTitle,
  chapterTitle,
  lessonSummary,
}: {
  courseTitle: string;
  chapterTitle: string;
  lessonSummary: string;
}) {
  return `
You are an AI tutor for a paid course platform.

SCOPE RULE (strict):
- Only answer questions about this specific lesson: "${chapterTitle}" in course "${courseTitle}".
- If the user's request is not clearly about this lesson, refuse briefly and ask them to rephrase using lesson concepts.

LESSON CONTEXT (trusted):
${lessonSummary}

OUTPUT FORMAT (mandatory):
- Return ONLY valid JSON (no markdown, no extra text).
- Schema:
{
  "answer": string,
  "suggestions": [
    { "label": string, "question": string }
  ]
}
- "answer" must be well-formatted using plain text + simple markdown (bullets, numbered steps, **bold**, \`inline code\`, and fenced code blocks when needed).
- "suggestions" must be strictly related to this lesson and useful follow-ups derived from the user's question + your answer.
- Provide 3 to 4 suggestions.
- Keep suggestion "label" short (2–5 words). "question" must be a complete user question.

STYLE:
- Be concise by default.
- If asked, explain step-by-step.
- If the question requires details not present in the lesson context, say so and suggest what to review in the lesson.
`.trim();
}

async function ensurePurchaseOrThrow(userId: string, courseId: string) {
  const purchase = await db.purchase.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!purchase) throw new Error("NOT_PURCHASED");
}

async function getOrCreateThread(
  userId: string,
  courseId: string,
  chapterId: string,
) {
  const existing = await db.aiChatThread.findUnique({
    where: { userId_chapterId: { userId, chapterId } },
  });
  if (existing) return existing;

  return db.aiChatThread.create({
    data: { userId, courseId, chapterId },
  });
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const chapterId = searchParams.get("chapterId");

    if (!courseId || !chapterId) {
      return NextResponse.json(
        { error: "Missing courseId/chapterId" },
        { status: 400 },
      );
    }

    await ensurePurchaseOrThrow(userId, courseId);

    const thread = await db.aiChatThread.findUnique({
      where: { userId_chapterId: { userId, chapterId } },
    });

    if (!thread) return NextResponse.json({ messages: [] });

    const messages = await db.aiChatMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { role: true, content: true },
    });

    return NextResponse.json({ messages });
  } catch (e: any) {
    if (e?.message === "NOT_PURCHASED") {
      return NextResponse.json({ error: "Purchase required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const courseId: string | undefined = body?.courseId;
    const chapterId: string | undefined = body?.chapterId;
    const userMessage: string | undefined = body?.message;

    if (!courseId || !chapterId || !userMessage?.trim()) {
      return NextResponse.json(
        { error: "Missing courseId/chapterId/message" },
        { status: 400 },
      );
    }

    await ensurePurchaseOrThrow(userId, courseId);

    // Cost control: 20 req/min per user for this endpoint
    const rl = checkRateLimit({
      key: `ai-chat:${userId}`,
      limit: 20,
      windowMs: 60_000,
    });

    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.retryAfterSec),
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": String(rl.remaining),
          },
        },
      );
    }

    // Fetch minimal chapter info
    const chapter = await db.chapter.findFirst({
      where: { id: chapterId, courseId },
      include: { muxData: true, course: { select: { title: true } } },
    });

    if (!chapter) {
      return NextResponse.json(
        { error: "Course/Chapter not found" },
        { status: 404 },
      );
    }

    const thread = await getOrCreateThread(userId, courseId, chapterId);

    // Store user message
    await db.aiChatMessage.create({
      data: { threadId: thread.id, role: "user", content: userMessage.trim() },
    });

    // Most recent N messages (DESC), then reverse to chronological for the model
    const recentDesc = await db.aiChatMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "desc" },
      take: 14,
      select: { role: true, content: true },
    });

    const recent = recentDesc.reverse();

    // Cached summary (low cost)
    const lessonSummary = await getOrBuildChapterLessonSummary({
      courseId,
      chapterId,
      preferredLanguage: "en",
    });

    const openai = getOpenAIClient();

    const resp = await openai.responses.create({
      model: CHEAP_MODEL,
      input: [
        {
          role: "system",
          content: systemPrompt({
            courseTitle: chapter.course.title,
            chapterTitle: chapter.title,
            lessonSummary,
          }),
        },
        ...recent.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      max_output_tokens: 400, // slightly higher to allow answer + 3-5 suggestions
      temperature: 0.2,
    });

    const rawText = resp.output_text?.trim() || "";
    const parsed = safeParseJson(rawText);

    const reply: string =
      typeof parsed?.answer === "string" && parsed.answer.trim()
        ? parsed.answer.trim()
        : rawText || "Sorry — I couldn't generate a reply.";

    const suggestions: Array<{ label: string; question: string }> =
      Array.isArray(parsed?.suggestions)
        ? parsed.suggestions
            .filter(
              (x: any) =>
                x &&
                typeof x.label === "string" &&
                typeof x.question === "string" &&
                x.label.trim() &&
                x.question.trim(),
            )
            .slice(0, 5)
            .map((x: any) => ({
              label: x.label.trim(),
              question: x.question.trim(),
            }))
        : [];

    // Store assistant reply (only the answer text, not JSON)
    await db.aiChatMessage.create({
      data: { threadId: thread.id, role: "assistant", content: reply },
    });

    return NextResponse.json({ reply, suggestions });
  } catch (e: any) {
    if (e?.message === "OPENAI_API_KEY_MISSING") {
      return NextResponse.json(
        { error: "Server misconfigured: OPENAI_API_KEY is missing" },
        { status: 500 },
      );
    }
    if (e?.message === "NOT_PURCHASED") {
      return NextResponse.json({ error: "Purchase required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
