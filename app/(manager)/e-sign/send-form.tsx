"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { sendEsign, startEsignUpload } from "./actions";

type Signer = { name: string; email: string };

export function SendDocumentForm({ leases }: { leases: { id: string; label: string; signers: Signer[] }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [leaseId, setLeaseId] = useState("");
  const [signers, setSigners] = useState<Signer[]>([{ name: "", email: "" }]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ error?: string; message?: string }>({});
  const setSigner = (i: number, change: Partial<Signer>) => setSigners((ss) => ss.map((s, j) => (j === i ? { ...s, ...change } : s)));

  function pickLease(id: string) {
    setLeaseId(id);
    const lease = leases.find((l) => l.id === id);
    // Start with the people on the lease; they can be changed or reordered.
    if (lease?.signers.length && signers.every((s) => !s.name && !s.email)) setSigners(lease.signers);
  }

  async function send() {
    setResult({});
    if (!file) return setResult({ error: "Choose the PDF to send." });
    setBusy(true);
    const start = await startEsignUpload({ type: file.type, size: file.size });
    if (!start.path || !start.token) {
      setBusy(false);
      return setResult({ error: start.error ?? "The upload couldn't start." });
    }
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }).storage;
    const up = await storage.from("documents").uploadToSignedUrl(start.path, start.token, file, { contentType: "application/pdf" });
    if (up.error) {
      setBusy(false);
      return setResult({ error: "The file didn't upload. Please try again." });
    }
    const r = await sendEsign({ path: start.path, title, leaseId: leaseId || null, signers });
    setBusy(false);
    setResult(r);
    if (r.message) {
      setTitle("");
      setFile(null);
      setLeaseId("");
      setSigners([{ name: "", email: "" }]);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4 p-5">
      {result.error && <Notice tone="danger">{result.error}</Notice>}
      {result.message && <Notice tone="success">{result.message}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Document name">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pet addendum" maxLength={200} />
        </Field>
        <Field label="PDF">
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-[var(--radius-control)] file:border file:border-line-strong file:bg-surface file:px-4 file:font-semibold" />
        </Field>
        <Field label="File it on a tenant (optional)" hint="The signed copy is filed on that tenant's documents">
          <Select value={leaseId} onChange={(e) => pickLease(e.target.value)}>
            <option value="">Don&apos;t file on a tenant</option>
            {leases.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink-2">Signers, in signing order</p>
        <div className="space-y-2">
          {signers.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
              <Input value={s.name} onChange={(e) => setSigner(i, { name: e.target.value })} placeholder={`Signer ${i + 1} full name`} aria-label={`Signer ${i + 1} name`} />
              <Input type="email" value={s.email} onChange={(e) => setSigner(i, { email: e.target.value })} placeholder="E-mail" aria-label={`Signer ${i + 1} e-mail`} />
              <Button type="button" small variant="ghost" onClick={() => setSigners((ss) => (ss.length > 1 ? ss.filter((_, j) => j !== i) : ss))} aria-label={`Remove signer ${i + 1}`}>
                Remove
              </Button>
            </div>
          ))}
        </div>
        {signers.length < 6 && (
          <Button type="button" small variant="ghost" className="mt-2" onClick={() => setSigners((ss) => [...ss, { name: "", email: "" }])}>
            + Add a signer
          </Button>
        )}
        <p className="mt-2 text-[13px] text-subtle">Each signer types their name exactly as entered here. Add yourself last if you sign too.</p>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={send} disabled={busy}>
          {busy ? "Sending…" : "Send for signature"}
        </Button>
      </div>
    </div>
  );
}
