export const isTeacher = (userId?:string|null):boolean => {
    return userId === process.env.NEXT_PUBLIC_TEACHER_USER_ID||
           userId === process.env.NEXT_PUBLIC_ADMIN_USER_ID_1;
}