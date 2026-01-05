import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function PUT(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { userId } = await auth();
    const { courseId } = await params;
    const { list } = await request.json();
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const ownCourse = await db.course.findUnique({
      where: {
        id: courseId,
        userId,
      },
    }); 
    if (!ownCourse) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    for (let item of list) {
        await db.chapter.update({
            where: {
                id: item.id,
            },
            data: {
                position: item.position,
            },
        });
    }
    return new NextResponse("Chapters reordered successfully", { status: 200 });
    } catch (error) {
        console.error("Error reordering chapters:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}