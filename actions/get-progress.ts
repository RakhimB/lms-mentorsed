import { db } from "@/lib/db";

export const getProgress = async (userId: string, courseId: string): Promise<number> => {
    try {
        const publishedChapters = await db.chapter.findMany({
            where: {
                courseId: courseId,
                isPublished: true
            },
            select: { id: true }
        });

        const publishedChapterIds = publishedChapters.map(chapter => chapter.id);

        const validcompletedChapters = await db.userProgress.count({
            where: {
                userId: userId,
                chapterId: { in: publishedChapterIds },
                isCompleted: true
            }
        });

        const progressPercentage = (validcompletedChapters / publishedChapterIds.length) * 100;
        return progressPercentage;

    } catch (error) {
        console.error("Error fetching progress:", error);
        return 0;
    }
}