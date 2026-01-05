"use client";

import { useEffect, useRef } from "react";
import "quill/dist/quill.snow.css";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const Editor = ({ value, onChange }: EditorProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const initQuill = async () => {
      const Quill = (await import("quill")).default;

      if (!containerRef.current || quillRef.current || !mounted) return;

      const quill = new Quill(containerRef.current, {
        theme: "snow",
        modules: {
          toolbar: [
            ["bold", "italic", "underline"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["link"],
          ],
        },
      });

      quill.root.innerHTML = value || "";

      quill.on("text-change", () => {
        onChange(quill.root.innerHTML);
      });

      quillRef.current = quill;
    };

    initQuill();

    return () => {
      mounted = false;
    };
  }, [onChange, value]);

  return <div className="bg-white" ref={containerRef} />;
};
