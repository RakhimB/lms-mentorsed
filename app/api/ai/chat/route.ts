import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { getOrBuildChapterLessonSummary } from "@/lib/chapter-lesson-summary";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");
  return new OpenAI({ apiKey });
}

const CHEAP_MODEL = "gpt-4o-mini";

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

    await ensurePurchaseOrThrow(userId, courseId);

    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        chapters: {
          where: { id: chapterId },
          include: { muxData: true },
        },
      },
    });

    const chapter = course?.chapters?.[0];

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

    // short history window
    const recent = await db.aiChatMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
      take: 14,
      select: { role: true, content: true },
    });

    // ✅ Chapter-level cached summary (low cost)
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
            courseTitle: course.title,
            chapterTitle: chapter.title,
            lessonSummary,
          }),
        },
        ...recent.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      max_output_tokens: 350,
      temperature: 0.2,
    });

    const reply =
      resp.output_text?.trim() || "Sorry — I couldn't generate a reply.";

    await db.aiChatMessage.create({
      data: { threadId: thread.id, role: "assistant", content: reply },
    });

    return NextResponse.json({ reply });
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
