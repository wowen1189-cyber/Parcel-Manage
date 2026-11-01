"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/ui";
import { finishPhotoUpload, startPhotoUpload } from "../../actions";

/** Add photos to a request straight from the phone camera. Files go to private storage. */
export function PhotoUpload({ workOrderId }: { workOrderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }).storage;
    for (const file of Array.from(files).slice(0, 6)) {
      const start = await startPhotoUpload({ workOrderId, type: file.type, size: file.size });
      if (!start.path || !start.token) {
        setError(start.error ?? "The upload couldn't start.");
        break;
      }
      const up = await storage.from("documents").uploadToSignedUrl(start.path, start.token, file, { contentType: file.type });
      if (up.error) {
        setError("A photo didn't upload. Please try again.");
        break;
      }
      await finishPhotoUpload({ workOrderId, path: start.path });
    }
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="space-y-2">
      {error && <Notice tone="danger">{error}</Notice>}
      <label className={`inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 text-[14px] font-semibold ${busy ? "opacity-60" : "hover:bg-surface-sunk"}`}>
        {busy ? "Uploading…" : "+ Add photos"}
        <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files)} />
      </label>
    </div>
  );
}
