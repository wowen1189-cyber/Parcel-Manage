"use client";

import { createClient } from "@supabase/supabase-js";
import { startTransition, useActionState, useRef, useState, type ReactNode } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { hoursLabel, type WriteUp } from "@/lib/job-finish-rules";
import type { InvoiceReadResult, UploadKind, UploadStart, WriteUpResult } from "@/lib/job-upload";

// Finishing a job, one step at a time on a phone: photos, what was done (the AI can write it up), the
// invoice (vendors), then a last look before sending. Photos upload as soon as they're picked, shrunk on
// the phone first so they go up fast on a cell signal. Used by the vendor's job link and by staff.

export type FinishState = { error?: string; message?: string; values?: Record<string, string> };
type Photo = { id: string; preview: string; path?: string; status: "uploading" | "done" | "error"; error?: string };
type Stage = "before" | "after";

type Props = {
  who: "vendor" | "staff";
  aiReady: boolean;
  suggestedHours: number | null;
  startUpload: (input: { kind: UploadKind; type: string; size: number }) => Promise<UploadStart>;
  writeUp: (input: { notes: string; parts: string; before: string[]; after: string[] }) => Promise<WriteUpResult>;
  readInvoice?: (path: string) => Promise<InvoiceReadResult>;
  finish: (state: FinishState, form: FormData) => Promise<FinishState>;
};

/** Shrink a photo to 1600px JPEG on the phone (keeps the original if the browser can't read it, e.g. HEIC on Chrome). */
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

async function put(startUpload: Props["startUpload"], kind: UploadKind, file: File): Promise<string> {
  const start = await startUpload({ kind, type: file.type || "image/jpeg", size: file.size });
  if (!start.path || !start.uploadToken) throw new Error(start.error ?? "The upload couldn't start.");
  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }).storage;
  const up = await storage.from("documents").uploadToSignedUrl(start.path, start.uploadToken, file, { contentType: file.type });
  if (up.error) throw new Error("It didn't upload. Check your signal and try again.");
  return start.path;
}

const HOURS = ["0.5", "1", "1.5", "2", "2.5", "3", "4", "5", "6", "8"];

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-12 flex-1 rounded-[var(--radius-control)] border px-3 text-[15px] font-semibold transition-colors ${selected ? "border-accent bg-accent-soft text-accent-deep" : "border-line-strong bg-surface text-ink hover:bg-surface-sunk"}`}
    >
      {children}
    </button>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M12 2l1.8 5.6L19.5 9.5l-5.7 1.9L12 17l-1.8-5.6L4.5 9.5l5.7-1.9L12 2Zm7 12l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14Z" />
    </svg>
  );
}

function PhotoPicker({ stage, photos, onAdd, onRemove }: { stage: Stage; photos: Photo[]; onAdd: (files: File[]) => void; onRemove: (id: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <div key={p.id} className="relative aspect-square overflow-hidden rounded-[10px] bg-surface-sunk">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt={`${stage === "before" ? "Before" : "After"} photo`} className={`size-full object-cover ${p.status === "uploading" ? "opacity-50" : ""}`} />
            {p.status === "uploading" && <span className="absolute inset-x-0 bottom-0 bg-ink/60 py-0.5 text-center text-[12px] font-semibold text-white">Uploading…</span>}
            {p.status === "error" && <span className="absolute inset-x-0 bottom-0 bg-danger py-0.5 text-center text-[12px] font-semibold text-white">Didn&apos;t upload</span>}
            <button type="button" onClick={() => onRemove(p.id)} aria-label="Remove photo" className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-ink/70 text-[18px] leading-none text-white">
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={() => input.current?.click()} className="grid aspect-square place-items-center rounded-[10px] border-2 border-dashed border-line-strong text-muted hover:border-accent hover:text-accent">
          <span className="grid justify-items-center gap-1 text-[13px] font-semibold">
            <CameraIcon />
            {photos.length ? "Add more" : "Add photos"}
          </span>
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label={`${stage === "before" ? "Before" : "After"} photos`}
        onChange={(e) => {
          onAdd([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function JobFinish({ who, aiReady, suggestedHours, startUpload, writeUp, readInvoice, finish }: Props) {
  const steps = who === "vendor" ? ["Photos", "Work done", "Invoice", "Send"] : ["Photos", "Work done", "Send"];
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<Record<Stage, Photo[]>>({ before: [], after: [] });
  const [notes, setNotes] = useState("");
  const [parts, setParts] = useState("");
  const [hours, setHours] = useState(suggestedHours ? String(suggestedHours) : "");
  const [fixed, setFixed] = useState<"" | "yes" | "no">("");
  const [followUp, setFollowUp] = useState("");
  const [damage, setDamage] = useState<"no" | "yes">("no");
  const [damageNote, setDamageNote] = useState("");
  const [ai, setAi] = useState<{ busy: boolean; reason?: string; result?: WriteUp; original?: string }>({ busy: false });
  const [invoice, setInvoice] = useState<{ path?: string; name?: string; busy?: string; note?: string }>({});
  const [amount, setAmount] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [stepError, setStepError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(finish, {});
  const top = useRef<HTMLDivElement>(null);

  const all = [...photos.before, ...photos.after];
  const uploading = all.some((p) => p.status === "uploading") || invoice.busy === "Uploading…";
  const paths = (s: Stage) => photos[s].filter((p) => p.path).map((p) => p.path!);

  function go(n: number) {
    setStepError(null);
    setStep(n);
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  function addPhotos(stage: Stage, files: File[]) {
    for (const file of files.slice(0, 10 - photos[stage].length)) {
      const id = Math.random().toString(36).slice(2);
      const preview = URL.createObjectURL(file);
      setPhotos((p) => ({ ...p, [stage]: [...p[stage], { id, preview, status: "uploading" }] }));
      shrink(file)
        .then((small) => put(startUpload, stage, small))
        .then((path) => setPhotos((p) => ({ ...p, [stage]: p[stage].map((x) => (x.id === id ? { ...x, path, status: "done" } : x)) })))
        .catch((e: unknown) => setPhotos((p) => ({ ...p, [stage]: p[stage].map((x) => (x.id === id ? { ...x, status: "error", error: e instanceof Error ? e.message : "Didn't upload." } : x)) })));
    }
  }
  function removePhoto(stage: Stage, id: string) {
    setPhotos((p) => {
      const gone = p[stage].find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return { ...p, [stage]: p[stage].filter((x) => x.id !== id) };
    });
  }

  async function askAi() {
    setAi({ busy: true });
    const r = await writeUp({ notes, parts, before: paths("before"), after: paths("after") }).catch(() => ({ ok: false as const, reason: "The AI couldn't be reached." }));
    if (!r.ok) return setAi({ busy: false, reason: r.reason });
    setAi({ busy: false, result: r.result, original: notes });
    setNotes(r.result.writeUp);
    if (!parts.trim() && r.result.parts) setParts(r.result.parts);
    if (!fixed && r.result.fixed === true && !r.result.followUp) setFixed("yes");
  }

  async function addInvoice(file: File | undefined) {
    if (!file) return;
    setInvoice({ name: file.name, busy: "Uploading…" });
    try {
      const small = file.type.startsWith("image/") ? await shrink(file) : file;
      const path = await put(startUpload, "invoice", small);
      setInvoice({ path, name: file.name, busy: readInvoice ? "Reading the total…" : undefined });
      if (readInvoice) {
        const r = await readInvoice(path).catch(() => ({ amount: null, number: null, note: "Couldn't read the total. Type it in." }));
        if (r.amount) setAmount(r.amount);
        if (r.number) setInvoiceNumber(r.number);
        setInvoice({ path, name: file.name, note: r.amount ? "We read the total from your invoice. Check it." : r.note });
      }
    } catch (e) {
      setInvoice({ note: e instanceof Error ? e.message : "It didn't upload." });
    }
  }

  function next() {
    setStepError(null);
    if (steps[step] === "Photos" && all.some((p) => p.status === "uploading")) return setStepError("Wait for the photos to finish uploading.");
    if (steps[step] === "Work done") {
      if (notes.trim().length < 3) return setStepError("Say what you did.");
      if (!fixed) return setStepError("Is the problem fixed? Choose one.");
      if (fixed === "no" && followUp.trim().length < 3) return setStepError("Say what's still needed for the next visit.");
      if (damage === "yes" && damageNote.trim().length < 3) return setStepError("Describe the damage that may be tenant-caused.");
      if (who === "staff" && amount && !/^\$?[\d,]+(\.\d{1,2})?$/.test(amount.trim())) return setStepError("Enter the cost in dollars, like 245.00.");
    }
    if (steps[step] === "Invoice") {
      if (invoice.busy) return setStepError("Wait for the invoice to finish.");
      if (invoice.path && !amount.trim()) return setStepError("Enter the invoice total.");
      if (amount && !/^\$?[\d,]+(\.\d{1,2})?$/.test(amount.trim())) return setStepError("Enter the total in dollars, like 245.00.");
    }
    go(step + 1);
  }

  function send() {
    const fd = new FormData();
    for (const p of paths("before")) fd.append("before_path", p);
    for (const p of paths("after")) fd.append("after_path", p);
    fd.set("resolution", notes);
    fd.set("parts", parts);
    fd.set("hours", hours);
    fd.set("fixed", fixed);
    fd.set("follow_up_note", fixed === "no" ? followUp : "");
    fd.set("damage", damage);
    fd.set("damage_note", damage === "yes" ? damageNote : "");
    fd.set("amount", amount);
    fd.set("invoice_number", invoiceNumber);
    if (invoice.path) fd.set("invoice_path", invoice.path);
    startTransition(() => action(fd));
  }

  if (state.message)
    return (
      <div className="py-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-accent-soft text-[28px] text-accent-deep" aria-hidden>
          ✓
        </span>
        <p className="mt-3 text-[18px] font-bold">{state.message}</p>
        <p className="mt-1 text-muted">The office has the photos and your write-up.</p>
      </div>
    );

  const failed = all.filter((p) => p.status === "error").length;
  return (
    <div ref={top} className="scroll-mt-4">
      <ol className="mb-5 flex gap-1.5" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s} className="flex-1">
            <button type="button" disabled={i > step} onClick={() => go(i)} className="w-full text-left disabled:cursor-default" aria-current={i === step ? "step" : undefined}>
              <span className={`block h-1.5 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
              <span className={`mt-1.5 block text-[12px] font-semibold ${i === step ? "text-ink" : "text-subtle"}`}>
                {i + 1}. {s}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {steps[step] === "Photos" && (
        <div className="space-y-5">
          <section>
            <h3 className="text-[16px] font-bold">Before</h3>
            <p className="mb-2 text-[14px] text-muted">What you found when you got there.</p>
            <PhotoPicker stage="before" photos={photos.before} onAdd={(f) => addPhotos("before", f)} onRemove={(id) => removePhoto("before", id)} />
          </section>
          <section>
            <h3 className="text-[16px] font-bold">After</h3>
            <p className="mb-2 text-[14px] text-muted">The finished work. Stand in the same spot as the before photo so the office can compare.</p>
            <PhotoPicker stage="after" photos={photos.after} onAdd={(f) => addPhotos("after", f)} onRemove={(id) => removePhoto("after", id)} />
          </section>
          {failed > 0 && <Notice tone="warn">{failed === 1 ? "One photo" : `${failed} photos`} didn&apos;t upload. Remove and add again, or carry on without.</Notice>}
          {!all.length && <p className="text-[14px] text-subtle">Photos are optional, but they protect you and the owner if there&apos;s ever a question about the work.</p>}
        </div>
      )}

      {steps[step] === "Work done" && (
        <div className="space-y-5">
          <div>
            <Field label="What did you do?" hint={ai.result ? undefined : "Rough notes are fine. Tap the microphone on your keyboard to talk instead of typing."}>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-32 text-[15px]" placeholder="toilet running. replaced flapper and fill valve, tested 5 flushes no leaks" />
            </Field>
            {aiReady && (
              <div className="mt-2 space-y-2">
                {!ai.result && (
                  <Button variant="secondary" small onClick={askAi} disabled={ai.busy || (notes.trim().length < 3 && !all.length)}>
                    <SparkIcon />
                    {ai.busy ? "Writing it up…" : "Write it up with AI"}
                  </Button>
                )}
                {ai.reason && <Notice tone="warn">{ai.reason}</Notice>}
                {ai.result && (
                  <div className="space-y-2 rounded-[var(--radius-control)] bg-info-bg px-3 py-2.5 text-[14px] text-info">
                    <p>
                      <strong>Written by AI</strong> from your notes{all.length ? " and photos" : ""}. Read it and fix anything that&apos;s wrong.{" "}
                      <button type="button" className="font-semibold underline" onClick={() => { setNotes(ai.original ?? ""); setAi({ busy: false }); }}>
                        Undo
                      </button>
                    </p>
                    {ai.result.photoCheck && <p>Photos: {ai.result.photoCheck}</p>}
                    {ai.result.followUp && fixed !== "no" && (
                      <p>
                        May need another visit: {ai.result.followUp}{" "}
                        <button type="button" className="font-semibold underline" onClick={() => { setFixed("no"); setFollowUp(ai.result!.followUp!); }}>
                          Mark it
                        </button>
                      </p>
                    )}
                    {ai.result.tenantDamage && damage !== "yes" && (
                      <p>
                        {ai.result.tenantDamage}{" "}
                        <button type="button" className="font-semibold underline" onClick={() => { setDamage("yes"); setDamageNote(ai.result!.tenantDamage!); }}>
                          Tell the office
                        </button>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <Field label="Parts and materials (optional)">
              <Input value={parts} onChange={(e) => setParts(e.target.value)} placeholder="Fill valve, flapper" />
            </Field>
            <Field label="Time on site">
              <Select value={hours} onChange={(e) => setHours(e.target.value)}>
                <option value="">Choose</option>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hoursLabel(h)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">Is the problem fixed?</legend>
            <div className="flex gap-2">
              <Choice selected={fixed === "yes"} onClick={() => setFixed("yes")}>Yes, all fixed</Choice>
              <Choice selected={fixed === "no"} onClick={() => setFixed("no")}>Needs another visit</Choice>
            </div>
            {fixed === "no" && (
              <div className="mt-2">
                <Field label="What's still needed?">
                  <Input value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder="Part on order; back Thursday to install" />
                </Field>
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">Any damage that looks tenant-caused?</legend>
            <div className="flex gap-2">
              <Choice selected={damage === "no"} onClick={() => setDamage("no")}>No</Choice>
              <Choice selected={damage === "yes"} onClick={() => setDamage("yes")}>Yes, maybe</Choice>
            </div>
            {damage === "yes" && (
              <div className="mt-2">
                <Field label="What did you see?" hint="The office reviews it and decides. Nothing is charged automatically.">
                  <Input value={damageNote} onChange={(e) => setDamageNote(e.target.value)} placeholder="Toy car stuck in the toilet trap" />
                </Field>
              </div>
            )}
          </fieldset>

          {who === "staff" && (
            <Field label="Cost ($, optional)" hint="Parts or the vendor's charge, if you know it">
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </Field>
          )}
        </div>
      )}

      {steps[step] === "Invoice" && (
        <div className="space-y-4">
          <p className="text-muted">Upload your invoice or take a photo of it. It goes to the office for approval before payment. No invoice for this job? Skip this step.</p>
          <label className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border-2 border-dashed border-line-strong px-4 text-[15px] font-semibold text-muted hover:border-accent hover:text-accent ${invoice.busy ? "pointer-events-none opacity-60" : ""}`}>
            <CameraIcon />
            {invoice.busy ?? (invoice.path ? `Replace ${invoice.name ?? "invoice"}` : "Add the invoice (PDF or photo)")}
            <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => { addInvoice(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {invoice.path && !invoice.busy && <p className="text-[14px] font-semibold text-accent-deep">✓ {invoice.name ?? "Invoice"} uploaded</p>}
          {invoice.note && <Notice tone={invoice.path ? "info" : "warn"}>{invoice.note}</Notice>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Invoice total ($)">
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
            </Field>
            <Field label="Invoice number">
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {steps[step] === "Send" && (
        <div className="space-y-4">
          <dl className="divide-y divide-line rounded-[var(--radius-control)] border border-line text-[15px]">
            <Summary label="Photos" edit={() => go(0)}>
              {photos.before.filter((p) => p.path).length} before · {photos.after.filter((p) => p.path).length} after
            </Summary>
            <Summary label="What you did" edit={() => go(1)}>
              <span className="whitespace-pre-wrap">{notes}</span>
              {parts && <span className="block text-muted">Parts: {parts}</span>}
              {hours && <span className="block text-muted">Time on site: {hoursLabel(hours)}</span>}
            </Summary>
            <Summary label="Fixed?" edit={() => go(1)}>
              {fixed === "yes" ? "Yes" : `Needs another visit: ${followUp}`}
              {damage === "yes" && <span className="block text-warn">Possible tenant damage: {damageNote}</span>}
            </Summary>
            {(who === "vendor" || amount) && (
              <Summary label={who === "vendor" ? "Invoice" : "Cost"} edit={() => go(who === "vendor" ? 2 : 1)}>
                {amount ? `$${amount.replace(/^\$/, "")}${invoiceNumber ? ` · #${invoiceNumber}` : ""}${invoice.path ? " · file attached" : ""}` : "None"}
              </Summary>
            )}
          </dl>
          {state.error && <Notice tone="danger">{state.error}</Notice>}
        </div>
      )}

      {stepError && (
        <div className="mt-4">
          <Notice tone="danger">{stepError}</Notice>
        </div>
      )}
      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <Button variant="secondary" onClick={() => go(step - 1)}>
            Back
          </Button>
        )}
        {step < steps.length - 1 ? (
          <Button className="flex-1" onClick={next}>
            {steps[step] === "Invoice" && !invoice.path && !amount ? "Skip, no invoice" : "Next"}
          </Button>
        ) : (
          <Button className="flex-1" onClick={send} disabled={pending || uploading}>
            {pending ? "Sending…" : "Mark job done"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Summary({ label, edit, children }: { label: string; edit: () => void; children: ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <dt className="w-24 shrink-0 text-[13px] font-semibold text-muted">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
      <button type="button" onClick={edit} className="self-start text-[14px] font-semibold text-accent">
        Change
      </button>
    </div>
  );
}
