import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { isTeacher } from "@/lib/teacher";

export async function DELETE(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ courseId: string; attachmentId: string }>;
  }
) {
  try {
    const { userId } = await auth();
    const { courseId, attachmentId } = await params;

    if (!userId || !isTeacher(userId)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const courseOwner = await db.course.findUnique({
      where: {
        id: courseId,
        userId,
      },
    });

    if (!courseOwner) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const attachment = await db.attachment.delete({
      where: {
        id: attachmentId,
        courseId,
      },
    });

    return NextResponse.json(attachment);
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}