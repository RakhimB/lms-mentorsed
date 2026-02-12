// app/api/ai/chat/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { getMuxTranscriptText } from "@/lib/mux-transcript";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHEAP_MODEL = "gpt-4o-mini"; // best default for low balance (fast + low cost)

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
  if (!purchase) {
    throw new Error("NOT_PURCHASED");
  }
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

async function buildLessonSummary({
  threadId,
  courseTitle,
  chapterTitle,
  chapterDescription,
  muxAssetId,
  muxPlaybackId,
}: {
  threadId: string;
  courseTitle: string;
  chapterTitle: string;
  chapterDescription: string | null;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
}): Promise<string> {
  // First: if description exists, it’s free context (no tokens)
  const fallback = (chapterDescription ?? "").slice(0, 4000);

  // Try transcript if we have mux IDs
  let transcript: string | null = null;
  if (muxAssetId && muxPlaybackId) {
    transcript = await getMuxTranscriptText({
      assetId: muxAssetId,
      playbackId: muxPlaybackId,
    });
  }

  const sourceText = transcript?.slice(0, 20_000) || fallback;

  // If nothing, return minimal summary
  if (!sourceText.trim()) {
    return `Lesson title: ${chapterTitle}\nNo transcript/description available. Only answer if user refers to the title/topic explicitly.`;
  }

  // One-time cheap summarization to reduce future token usage
  const resp = await openai.responses.create({
    model: CHEAP_MODEL,
    input: [
      {
        role: "system",
        content:
          "Summarize lesson content for tutoring. Output bullet points + key terms + 2-3 common misconceptions. Keep under 250 tokens.",
      },
      {
        role: "user",
        content: `Course: ${courseTitle}\nLesson: ${chapterTitle}\n\nContent:\n${sourceText}`,
      },
    ],
    max_output_tokens: 280,
  });

  const summary =
    resp.output_text?.trim() || `Lesson title: ${chapterTitle}\n${fallback}`;

  await db.aiChatThread.update({
    where: { id: threadId },
    data: { lessonSummary: summary },
  });

  return summary;
}

// GET returns persisted history for (courseId, chapterId)
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const chapterId = searchParams.get("chapterId");
    if (!courseId || !chapterId) {
      return NextResponse.json(
        { error: "Missing courseId/chapterId" },
        { status: 400 },
      );
    }

    // Optional: you can enforce purchase even for reading history
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

// POST stores user message -> calls OpenAI -> stores assistant message -> returns reply
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    // ✅ Real server-side enforcement
    await ensurePurchaseOrThrow(userId, courseId);

    const { chapter, course } = await db.course
      .findUnique({
        where: { id: courseId },
        include: {
          chapters: {
            where: { id: chapterId },
            include: { muxData: true },
          },
        },
      })
      .then((c) => {
        const chapter = c?.chapters?.[0];
        return { course: c, chapter };
      });

    if (!course || !chapter) {
      return NextResponse.json(
        { error: "Course/Chapter not found" },
        { status: 404 },
      );
    }

    const thread = await getOrCreateThread(userId, courseId, chapterId);

    await db.aiChatMessage.create({
      data: { threadId: thread.id, role: "user", content: userMessage.trim() },
    });

    // Load short history window (token control)
    const recent = await db.aiChatMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
      take: 14,
      select: { role: true, content: true },
    });

    // Cache / compute lesson summary (token optimization)
    const lessonSummary =
      thread.lessonSummary ??
      (await buildLessonSummary({
        threadId: thread.id,
        courseTitle: course.title,
        chapterTitle: chapter.title,
        chapterDescription: chapter.description,
        muxAssetId: chapter.muxData?.assetId ?? null,
        muxPlaybackId: chapter.muxData?.playbackId ?? null,
      }));

    const resp = await openai.responses.create({
      model: CHEAP_MODEL,
      input: [
        {
          role: "system",
          content: systemPrompt({
            courseTitle: course.title,
            chapterTitle: chapter.title,
            lessonSummary,
          }),
        },
        ...recent.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      max_output_tokens: 350, // hard cap to protect your balance
    });

    const reply =
      resp.output_text?.trim() || "Sorry — I couldn't generate a reply.";

    await db.aiChatMessage.create({
      data: { threadId: thread.id, role: "assistant", content: reply },
    });

    return NextResponse.json({ reply });
  } catch (e: any) {
    if (e?.message === "NOT_PURCHASED") {
      return NextResponse.json({ error: "Purchase required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
