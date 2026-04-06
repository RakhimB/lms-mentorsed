import { Category, Course } from "@prisma/client";
import { db } from "@/lib/db";
import { getCourseProgressMap } from "@/actions/get-progress";

type CourseWithProgressWithCategory = Course & {
  category: Category | null;
  chapters: { id: string }[];
  progress: number | null;
};

type GetCourses = {
  userId: string;
  categoryId?: string;
  title?: string;
};

export const getCourses = async ({
  userId,
  categoryId,
  title,
}: GetCourses): Promise<CourseWithProgressWithCategory[]> => {
  try {
    const courses = await db.course.findMany({
      where: {
        isPublished: true,
        title: {
          contains: title,
        },
        categoryId,
      },
      include: {
        category: true,
        chapters: {
          where: {
            isPublished: true,
          },
          select: {
            id: true,
          },
        },
        purchases: {
          where: {
            userId,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const purchasedCourseIds = courses
      .filter((course) => course.purchases.length > 0)
      .map((course) => course.id);

    const progressMap = await getCourseProgressMap(userId, purchasedCourseIds);

    const coursesWithProgress: CourseWithProgressWithCategory[] = courses.map(
      (course) => {
        if (course.purchases.length === 0) {
          return {
            ...course,
            progress: null,
          };
        }

        return {
          ...course,
          progress: progressMap[course.id] ?? 0,
        };
      },
    );

    return coursesWithProgress;
  } catch (error) {
    console.error("Error fetching courses:", error);
    return [];
  }
};
