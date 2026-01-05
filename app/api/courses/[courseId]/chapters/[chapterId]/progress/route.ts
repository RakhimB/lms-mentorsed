import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";


export async function PUT(
  request: Request,
  { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { chapterId } = await params;
    const { isCompleted } = await request.json();
    const userProgress = await db.userProgress.upsert({
      where: {
        userId_chapterId: {
          userId,
          chapterId: chapterId,
        },
      },
      update: {
        isCompleted: isCompleted,
      },
      create: {
        userId,
        chapterId: chapterId,
        isCompleted: isCompleted,
      },
    });



    return NextResponse.json(userProgress);
  } catch (error) {
    console.log("Error fetching courses:", error);
    throw new NextResponse("Internal Server Error", { status: 500 });
  }
}
