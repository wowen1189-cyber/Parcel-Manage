"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice, Select } from "@/components/ui";
import { DOCUMENT_CATEGORIES } from "../document-labels";
import { finishTenantDocument, startTenantDocument } from "../document-actions";

export function TenantDocumentUpload({ leaseId }: { leaseId: string }) {
  const router = useRouter();
  const [category, setCategory] = useState("other");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }).storage;
    for (const file of Array.from(files).slice(0, 10)) {
      const start = await startTenantDocument({ leaseId, type: file.type, size: file.size });
      if (!start.path || !start.token) {
        setError(start.error ?? "The upload couldn't start.");
        break;
      }
      const up = await storage.from("documents").uploadToSignedUrl(start.path, start.token, file, { contentType: file.type });
      if (up.error) {
        setError(`${file.name} didn't upload. Please try again.`);
        break;
      }
      const done = await finishTenantDocument({ leaseId, path: start.path, fileName: file.name, category });
      if (done.error) {
        setError(done.error);
        break;
      }
    }
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="space-y-2 border-t border-line px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Document type" className="w-auto">
          {Object.entries(DOCUMENT_CATEGORIES).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
        <label className={`inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 text-[14px] font-semibold ${busy ? "opacity-60" : "hover:bg-surface-sunk"}`}>
          {busy ? "Uploading…" : "+ Add documents"}
          <input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp,.docx" className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
