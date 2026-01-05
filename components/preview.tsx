"use client";

interface PreviewProps {
  value: string;
}

export const Preview = ({ value }: PreviewProps) => {
  return (
    <div className="bg-slate-100 p-4 ">
      <div className="ql-editor" dangerouslySetInnerHTML={{ __html: value }} />
    </div>
  );
};
