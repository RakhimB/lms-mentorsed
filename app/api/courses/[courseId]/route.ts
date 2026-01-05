import {auth} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import Mux from "@mux/mux-node";
import { isTeacher } from "@/lib/teacher";


const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

const { video } = mux;

export async function DELETE (
    request: Request,
    {params}: {params:Promise<{courseId: string}>}
) {
    try {
        const {userId} = await auth();

        if (!userId|| !isTeacher(userId)) {
            return new NextResponse("Unauthorized", {status: 401});
        }
        const {courseId} = await params;

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

            for (const chapter of course.chapters) {
                if (chapter.muxData?.assetId) {
                    await video.assets.delete(chapter.muxData.assetId);
                }
            }


            const deletedCourse = await db.course.delete({
                where: {
                    id: courseId,
                },
            });
            
            return NextResponse.json(deletedCourse);

    } catch (error) {
        console.log("Error deleting course:", error);
        return new NextResponse("Internal Server Error", {status: 500});
    }
}

export async function PATCH (
    request: Request,
    {params}: {params:Promise<{courseId: string}>}
) {
    try {
        const {userId} = await auth();
        const {courseId} = await params;
        const values = await request.json();

        if (!userId || !isTeacher(userId)) {
            return new NextResponse("Unauthorized", {status: 401});
        }

        const course = await db.course.update({
            where: {
                id: courseId,
                userId
            },
            data:{
                ...values,
            }
        });
        return NextResponse.json(course);

    } catch (error) {
        console.log("[COURSE_ID]", error);
        return new NextResponse("Internal error", {status: 500});
    }
}