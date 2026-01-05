import {db} from "@/lib/db";
import {redirect} from "next/navigation";

const CourseIdPage = async ({ 
    params 
    }: { 
    params: Promise<{ courseId: string }>}) => {
    const resolvedParams = await params;

        const course = await db.course.findUnique({
            where: {
                id: resolvedParams.courseId,
            },
            include: {
                chapters:{
                    where: {
                        isPublished: true,
                    },
                    orderBy: {
                        position: 'asc',
                    }
                }
            }
        });

        if(!course){
            return redirect('/');
        }

        return redirect(`/courses/${resolvedParams.courseId}/chapters/${course.chapters[0].id}`);


    return(
        <div>
            Course Page
        </div>
    );
}

export default CourseIdPage;