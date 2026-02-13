import crypto from "crypto";
import OpenAI from "openai";
import { db } from "@/lib/db";
import {
  getGeneratedVodTextTrackId,
  getMuxTranscriptText,
} from "@/lib/mux-transcript";

const MODEL = "gpt-4o-mini";

// Cost controls
const MAX_SOURCE_CHARS = 20_000;
const SUMMARY_MAX_OUTPUT_TOKENS = 280;

function hashText(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");
  return new OpenAI({ apiKey });
}

/**
 * Returns per-chapter cached summary.
 * Regenerates only if transcript/description changed.
 */
export async function getOrBuildChapterLessonSummary(opts: {
  courseId: string;
  chapterId: string;
  preferredLanguage?: string; // "en", "tr", or undefined
  forceRefresh?: boolean;
}) {
  const { courseId, chapterId, preferredLanguage, forceRefresh } = opts;

  const chapter = await db.chapter.findUnique({
    where: { id: chapterId, courseId },
    include: { muxData: true, course: { select: { title: true } } },
  });

  if (!chapter) throw new Error("CHAPTER_NOT_FOUND");

  // 1) Try transcript first (Mux generated_vod + ready)
  let transcript: string | null = null;

  if (chapter.muxData?.assetId && chapter.muxData?.playbackId) {
    const trackId = await getGeneratedVodTextTrackId({
      assetId: chapter.muxData.assetId,
      preferredLanguage,
    });

    if (trackId) {
      transcript = await getMuxTranscriptText({
        playbackId: chapter.muxData.playbackId,
        trackId,
      });
    }
  }

  // 2) Fallback to description if transcript isn't ready yet
  const fallback = (chapter.description ?? "").slice(0, 4000);
  const sourceText = (
    transcript?.slice(0, MAX_SOURCE_CHARS) || fallback
  ).trim();

  // If nothing, cache a minimal summary
  if (!sourceText) {
    const minimal = `Lesson: ${chapter.title}\nNo transcript/description available yet.`;
    if (!chapter.aiLessonSummary || forceRefresh) {
      await db.chapter.update({
        where: { id: chapter.id },
        data: {
          aiLessonSummary: minimal,
          aiLessonSummarySourceHash: "no-source",
          aiLessonSummaryUpdatedAt: new Date(),
        },
      });
    }
    return minimal;
  }

  const sourceHash = hashText(sourceText);

  // 3) If cached and same hash → reuse
  if (
    !forceRefresh &&
    chapter.aiLessonSummary &&
    chapter.aiLessonSummarySourceHash === sourceHash
  ) {
    return chapter.aiLessonSummary;
  }

  // 4) Generate summary once (cheap)
  const openai = getOpenAIClient();
  const resp = await openai.responses.create({
    model: MODEL,
    input: [
      {
        role: "system",
        content:
          "Create a compact lesson summary for an AI tutor. Output: (1) 6-10 bullet key points, (2) key terms list, (3) 2-3 common misconceptions. Stay under 250 tokens.",
      },
      {
        role: "user",
        content: `Course: ${chapter.course.title}\nLesson: ${chapter.title}\n\nContent:\n${sourceText}`,
      },
    ],
    max_output_tokens: SUMMARY_MAX_OUTPUT_TOKENS,
    temperature: 0.2,
  });

  const summary =
    resp.output_text?.trim() || `Lesson: ${chapter.title}\n${fallback}`.trim();

  // 5) Save per chapter (shared cache!)
  await db.chapter.update({
    where: { id: chapter.id },
    data: {
      aiLessonSummary: summary,
      aiLessonSummarySourceHash: sourceHash,
      aiLessonSummaryUpdatedAt: new Date(),
    },
  });

  return summary;
}
