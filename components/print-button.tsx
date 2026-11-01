"use client";

import { buttonClass } from "@/components/ui";

export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`${buttonClass("secondary", true)} print:hidden`}>
      {label}
    </button>
  );
}
