"use client";

import { UploadDropzone } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import toast from "react-hot-toast";

interface FileUploadProps {
  onChange: (url?: string) => void;
  endpoint: keyof OurFileRouter;
}

export const FileUpload = ({ onChange, endpoint }: FileUploadProps) => {
  return (
    <UploadDropzone<OurFileRouter, typeof endpoint>
      endpoint={endpoint}
      appearance={{
        uploadIcon: "w-10 h-10",
        container: "border border-dashed p-8 border-slate-300 bg-slate-50",
        button:
          "bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md",
        allowedContent: "text-slate-500",
        label: "text-slate-900",
      }}
      onClientUploadComplete={(res) => {
        onChange(res?.[0]?.ufsUrl);
        toast.success("File uploaded successfully!");
      }}
      onUploadError={(error: Error) => {
        toast.error(`${error?.message}`);
      }}
    />
  );
};
