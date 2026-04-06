import { db } from "@/lib/db";
import {
  Attachment,
  Chapter,
  Course,
  MuxData,
  UserProgress,
} from "@prisma/client";

type GetChapterProps = {
  userId: string;
  courseId: string;
  chapterId: string;
};

type GetChapterReturn = {
  chapter: Chapter | null;
  course: Course | null;
  muxData: MuxData | null;
  attachments: Attachment[];
  nextChapter: Chapter | null;
  userProgress: UserProgress | null;
  purchase: { id: string } | null;
};

export const getChapter = async ({
  userId,
  courseId,
  chapterId,
}: GetChapterProps): Promise<GetChapterReturn> => {
  try {
    const [purchase, course, chapter] = await Promise.all([
      db.purchase.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId,
          },
        },
        select: {
          id: true,
        },
      }),
      db.course.findUnique({
        where: {
          id: courseId,
        },
      }),
      db.chapter.findUnique({
        where: {
          id: chapterId,
          courseId,
        },
      }),
    ]);

    if (!course || !chapter) {
      return {
        chapter: null,
        course: null,
        muxData: null,
        attachments: [],
        nextChapter: null,
        userProgress: null,
        purchase: null,
      };
    }

    const isPurchased = !!purchase;
    const isFreeChapter = chapter.isFree;

    if (!chapter.isPublished && !isPurchased) {
      return {
        chapter: null,
        course,
        muxData: null,
        attachments: [],
        nextChapter: null,
        userProgress: null,
        purchase,
      };
    }

    const canAccessFullCourse = isPurchased;
    const canAccessChapter = isFreeChapter || canAccessFullCourse;

    const [muxData, attachments, nextChapter, userProgress] = await Promise.all(
      [
        db.muxData.findUnique({
          where: {
            chapterId,
          },
        }),
        canAccessFullCourse
          ? db.attachment.findMany({
              where: {
                courseId,
              },
              orderBy: {
                createdAt: "desc",
              },
            })
          : Promise.resolve([]),
        canAccessChapter
          ? db.chapter.findFirst({
              where: {
                courseId,
                isPublished: true,
                position: {
                  gt: chapter.position,
                },
              },
              orderBy: {
                position: "asc",
              },
            })
          : Promise.resolve(null),
        canAccessChapter
          ? db.userProgress.findUnique({
              where: {
                userId_chapterId: {
                  userId,
                  chapterId,
                },
              },
            })
          : Promise.resolve(null),
      ],
    );

    return {
      chapter,
      course,
      muxData,
      attachments,
      nextChapter,
      userProgress,
      purchase,
    };
  } catch (error) {
    console.error("[GET_CHAPTER]", error);

    return {
      chapter: null,
      course: null,
      muxData: null,
      attachments: [],
      nextChapter: null,
      userProgress: null,
      purchase: null,
    };
  }
};
