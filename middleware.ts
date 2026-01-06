import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isTeacher } from "@/lib/teacher";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/stripe",
  "/api/uploadthing(.*)",
]);

const isTeacherRoute = createRouteMatcher(["/teacher(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // 🔐 Not logged in → force sign-in
  if (!userId && !isPublicRoute(req)) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // 👩‍🏫 Logged in but not teacher → block teacher routes
  if (isTeacherRoute(req) && !isTeacher(userId)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
    matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
