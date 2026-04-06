import { db } from "@/lib/db";

export const getProgress = async (
  userId: string,
  courseId: string,
): Promise<number> => {
  try {
    const publishedChapters = await db.chapter.findMany({
      where: {
        courseId,
        isPublished: true,
      },
      select: {
        id: true,
      },
    });

    const publishedChapterIds = publishedChapters.map((chapter) => chapter.id);

    if (publishedChapterIds.length === 0) {
      return 0;
    }

    const validCompletedChapters = await db.userProgress.count({
      where: {
        userId,
        chapterId: { in: publishedChapterIds },
        isCompleted: true,
      },
    });

    return (validCompletedChapters / publishedChapterIds.length) * 100;
  } catch (error) {
    console.error("Error fetching progress:", error);
    return 0;
  }
};

export const getCourseProgressMap = async (
  userId: string,
  courseIds: string[],
): Promise<Record<string, number>> => {
  try {
    if (courseIds.length === 0) {
      return {};
    }

    const publishedChapters = await db.chapter.findMany({
      where: {
        courseId: { in: courseIds },
        isPublished: true,
      },
      select: {
        id: true,
        courseId: true,
      },
    });

    if (publishedChapters.length === 0) {
      return courseIds.reduce<Record<string, number>>((acc, courseId) => {
        acc[courseId] = 0;
        return acc;
      }, {});
    }

    const publishedChapterIds = publishedChapters.map((chapter) => chapter.id);

    const completedProgressRows = await db.userProgress.findMany({
      where: {
        userId,
        chapterId: { in: publishedChapterIds },
        isCompleted: true,
      },
      select: {
        chapterId: true,
      },
    });

    const totalPublishedByCourse = new Map<string, number>();
    const chapterToCourse = new Map<string, string>();

    for (const chapter of publishedChapters) {
      chapterToCourse.set(chapter.id, chapter.courseId);
      totalPublishedByCourse.set(
        chapter.courseId,
        (totalPublishedByCourse.get(chapter.courseId) ?? 0) + 1,
      );
    }

    const completedByCourse = new Map<string, number>();

    for (const row of completedProgressRows) {
      const courseId = chapterToCourse.get(row.chapterId);

      if (!courseId) continue;

      completedByCourse.set(
        courseId,
        (completedByCourse.get(courseId) ?? 0) + 1,
      );
    }

    const progressMap: Record<string, number> = {};

    for (const courseId of courseIds) {
      const total = totalPublishedByCourse.get(courseId) ?? 0;
      const completed = completedByCourse.get(courseId) ?? 0;

      progressMap[courseId] = total === 0 ? 0 : (completed / total) * 100;
    }

    return progressMap;
  } catch (error) {
    console.error("Error fetching course progress map:", error);
    return courseIds.reduce<Record<string, number>>((acc, courseId) => {
      acc[courseId] = 0;
      return acc;
    }, {});
  }
};
