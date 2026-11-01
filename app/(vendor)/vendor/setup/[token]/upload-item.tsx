"use client";

import { createClient } from "@supabase/supabase-js";
import { useActionState, useRef, useState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { finishVendorUpload, startVendorUpload, type UploadState } from "./actions";

const empty: UploadState = {};

// One document: pick a file (or take a photo), give the policy end date if needed, upload.
// The file goes straight to private storage with a one-time URL; then the server records it.
export function UploadItem({ token, item, needsExpiry, today }: { token: string; item: string; needsExpiry: boolean; today: string }) {
  const [state, finish, finishing] = useActionState(finishVendorUpload, empty);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(form: FormData) {
    setError(null);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return setError("Choose a file to upload.");
    if (needsExpiry && !form.get("expires_on")) return setError("Enter the date the policy ends.");
    setUploading(true);
    try {
      const start = await startVendorUpload({ token, item, type: file.type, size: file.size });
      if (start.error || !start.path || !start.uploadToken) return setError(start.error ?? "The upload couldn't start. Please try again.");
      const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }).storage;
      const up = await storage.from("documents").uploadToSignedUrl(start.path, start.uploadToken, file, { contentType: file.type });
      if (up.error) return setError("The upload didn't go through. Please try again.");
      form.set("path", start.path);
      form.delete("file");
      finish(form);
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || finishing;
  return (
    <form ref={formRef} action={submit} className="mt-4 space-y-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="item" value={item} />
      {(error || state.error) && <Notice tone="danger">{error ?? state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <div className={`grid gap-3 ${needsExpiry ? "sm:grid-cols-[1fr_200px]" : ""}`}>
        <Field label="File (PDF or photo)">
          <Input type="file" name="file" accept="application/pdf,image/*" className="py-2.5" />
        </Field>
        {needsExpiry && (
          <Field label="Policy ends">
            <Input type="date" name="expires_on" min={today} />
          </Field>
        )}
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}
