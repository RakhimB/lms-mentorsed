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
            });

            if (!course) {
                return new NextResponse("Not found!", {status: 404});
            }

            const unpublishedCourse = await db.course.update({
                where: {
                    id: courseId,
                    userId,
                },
                data: {
                    isPublished: false,
                },
            });

        return NextResponse.json(unpublishedCourse);
    } catch (error) {
        console.log("Error unpublishing course:", error);
        return new NextResponse("Internal Server Error", {status: 500});
    }
}
