import { Category, Chapter, Course } from "@prisma/client";
import { db } from "@/lib/db";
import { getCourseProgressMap } from "@/actions/get-progress";

type CourseWithProgressWithCategory = Course & {
  category: Category;
  chapters: Chapter[];
  progress: number | null;
};

type DashboardCourses = {
  completedCourses: any[];
  coursesInProgress: any[];
};

export const getDashboardCourses = async (
  userId: string,
): Promise<DashboardCourses> => {
  try {
    const purchasedCourses = await db.purchase.findMany({
      where: {
        userId,
      },
      select: {
        course: {
          include: {
            category: true,
            chapters: {
              where: {
                isPublished: true,
              },
            },
          },
        },
      },
    });

    const courses = purchasedCourses.map(
      (purchase) => purchase.course,
    ) as CourseWithProgressWithCategory[];

    const courseIds = courses.map((course) => course.id);
    const progressMap = await getCourseProgressMap(userId, courseIds);

    const coursesWithProgress = courses.map((course) => ({
      ...course,
      progress: progressMap[course.id] ?? 0,
    }));

    const completedCourses = coursesWithProgress.filter(
      (course) => course.progress === 100,
    );

    const coursesInProgress = coursesWithProgress.filter(
      (course) => (course.progress ?? 0) < 100,
    );

    return {
      completedCourses,
      coursesInProgress,
    };
  } catch (error) {
    console.log("Error fetching dashboard courses:", error);
    return {
      completedCourses: [],
      coursesInProgress: [],
    };
  }
};
