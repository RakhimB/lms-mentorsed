import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";
import { UploadThingError } from "uploadthing/server";
import { isTeacher } from "@/lib/teacher";
const f = createUploadthing();
const handleAuth = async () => {
  const { userId } = await auth();
  const isAuthorized = isTeacher(userId);
  if (!userId || !isAuthorized) throw new Error("Unauthorized");
  return { userId };
};

export const ourFileRouter = {
  courseImage: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(() => handleAuth())
    .onUploadComplete(() => {}),
  courseAttachments: f({
    image: { maxFileSize: "8MB" },
    pdf: { maxFileSize: "32MB" },
    audio: { maxFileSize: "1GB" },
    video: { maxFileSize: "2GB" },
    text: { maxFileSize: "4MB" },
  })
    .middleware(handleAuth)
    .onUploadComplete(() => {}),

  chapterVideo: f({
    video: { maxFileSize: "512GB", maxFileCount: 1 },
  })
    .middleware(() => handleAuth())
    .onUploadComplete(() => {}),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
