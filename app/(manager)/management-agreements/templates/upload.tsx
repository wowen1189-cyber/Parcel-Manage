"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/ui";
import { importTemplate, startTemplateUpload } from "./actions";

// Upload a PDF or Word agreement: straight to storage with a one-time link, then read into a template.
export function UploadTemplate() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const start = await startTemplateUpload({ type: file.type, size: file.size });
    if (!start.path || !start.token) {
      setError(start.error ?? "The upload couldn't start.");
      setBusy(false);
      return;
    }
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }).storage;
    const up = await storage.from("documents").uploadToSignedUrl(start.path, start.token, file, { contentType: file.type });
    if (up.error) {
      setError("The file didn't upload. Please try again.");
      setBusy(false);
      return;
    }
    const done = await importTemplate({ path: start.path, fileName: file.name });
    if (!done.id) {
      setError(done.error ?? "That file couldn't be read.");
      setBusy(false);
      return;
    }
    router.push(`/management-agreements/templates/${done.id}`);
  }
  return (
    <div className="space-y-2">
      <label className={`inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-control)] bg-accent px-4 text-[14px] font-semibold text-white ${busy ? "opacity-60" : "hover:opacity-90"}`}>
        {busy ? "Reading your agreement…" : "Upload your agreement (PDF or Word)"}
        <input type="file" accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx" className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
