import React from "react";

interface SkipLinkProps {
  targetId: string;
  label?: string;
}

export default function SkipLink({ targetId, label = "تجاوز التنقل والانتقال إلى المحتوى الرئيسي" }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="pointer-events-none fixed right-4 top-4 z-[100] -translate-y-16 rounded-xl bg-sky-600 px-4 py-3 text-sm font-black text-white opacity-0 shadow-xl transition focus:pointer-events-auto focus:translate-y-0 focus:opacity-100"
    >
      {label}
    </a>
  );
}
