import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { url } from "inspector/promises";
import { isTeacher } from "@/lib/teacher";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await auth();
    const { title } = await request.json();
    const { courseId } = await params;
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const courseOwner = await db.course.findUnique({
      where: {
        id: courseId,
        userId: userId,
      },
    });

    if (!courseOwner) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const lastChapter = await db.chapter.findFirst({
      where: {
        courseId: courseId,
      },
      orderBy: {
        position: "desc",
      },
    });

    const newPosition = lastChapter ? lastChapter.position + 1 : 1;

    const chapter = await db.chapter.create({
        data: {
          title,
          courseId: courseId,
          position: newPosition,
        },
      });

    return NextResponse.json(chapter);
    
  } catch (error) {
    console.error("Error creating chapters:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
