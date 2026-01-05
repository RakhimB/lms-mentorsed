import {auth} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";


export async function PATCH (
    request: Request,
    {params}: {params:Promise<{courseId: string}>}
) {
    try {
        const {userId} = await auth();

        const {courseId} = await params;

        
        if (!userId) {
            return new NextResponse("Unauthorized", {status: 401});
        }

        const course = await db.course.findUnique({
            where: {
                id: courseId,
                userId,
            },
            include: {
                chapters:{
                    include:{
                        muxData: true,
                    }
                }
            },
            });

            if (!course) {
                return new NextResponse("Not found!", {status: 404});
            }

            const hasPublishedChapters = course.chapters.some((chapter) => chapter.isPublished);

            if (!course.title || !course.description || !course.imageUrl || !course.categoryId || !hasPublishedChapters) {
                return new NextResponse("Missing required fields", {status: 401});
            }

            const publishedCourse = await db.course.update({
                where: {
                    id: courseId,
                    userId,
                },
                data: {
                    isPublished: true,
                },
            });

        return NextResponse.json(publishedCourse);
    } catch (error) {
        console.log("Error publishing course:", error);
        return new NextResponse("Internal Server Error", {status: 500});
    }
}