"use client";

import { createClient } from "@supabase/supabase-js";
import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { CONDITIONS, type Room } from "@/lib/inspections";
import { saveInspection, startInspectionPhoto, type InspectionState } from "../../../inspection-actions";

const empty: InspectionState = {};
let seq = 0;

// Room by room: condition, notes and photos. Photos upload straight to private storage as they're picked;
// Save stores the rooms. `photoUrls` are short-lived links for photos already saved.
export function InspectionEditor({ leaseId, kind, inspectedOn, rooms: initial, notes, photoUrls, canEdit }: { leaseId: string; kind: string; inspectedOn: string; rooms: Room[]; notes: string; photoUrls: Record<string, string>; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveInspection, empty);
  const [rooms, setRooms] = useState<Room[]>(initial);
  const [previews, setPreviews] = useState<Record<string, string>>(photoUrls);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const update = (i: number, change: Partial<Room>) => setRooms((rs) => rs.map((r, j) => (j === i ? { ...r, ...change } : r)));

  async function addPhotos(i: number, files: FileList | null) {
    if (!files?.length) return;
    setUploading(rooms[i].id);
    setUploadError(null);
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }).storage;
    const added: string[] = [];
    for (const file of Array.from(files).slice(0, 12 - rooms[i].photos.length)) {
      const start = await startInspectionPhoto({ leaseId, kind, type: file.type, size: file.size });
      if (!start.path || !start.token) {
        setUploadError(start.error ?? "The upload couldn't start.");
        break;
      }
      const up = await storage.from("documents").uploadToSignedUrl(start.path, start.token, file, { contentType: file.type });
      if (up.error) {
        setUploadError(`${file.name} didn't upload. Please try again.`);
        break;
      }
      added.push(start.path);
      setPreviews((p) => ({ ...p, [start.path!]: URL.createObjectURL(file) }));
    }
    setRooms((rs) => rs.map((r, j) => (j === i ? { ...r, photos: [...r.photos, ...added] } : r)));
    setUploading(null);
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="lease_id" value={leaseId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="rooms" value={JSON.stringify(rooms)} />
      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Inspected on">
            <Input type="date" name="inspected_on" defaultValue={inspectedOn} required />
          </Field>
          <Button type="submit" disabled={pending || Boolean(uploading)}>
            {pending ? "Saving…" : "Save inspection"}
          </Button>
        </div>
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        {state.message && <Notice tone="success">{state.message} Photos and notes are kept with the lease.</Notice>}
        {uploadError && <Notice tone="danger">{uploadError}</Notice>}

        {rooms.map((r, i) => (
          <div key={r.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
              <Field label="Room">
                <Input value={r.room} onChange={(e) => update(i, { room: e.target.value })} maxLength={80} />
              </Field>
              <Field label="Condition">
                <Select value={r.condition} onChange={(e) => update(i, { condition: e.target.value as Room["condition"] })}>
                  {Object.entries(CONDITIONS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="button" variant="ghost" small onClick={() => setRooms((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove ${r.room}`}>
                Remove
              </Button>
            </div>
            <div className="mt-3">
              <Field label="Notes" hint="What you see: location, size, what's damaged or missing.">
                <Textarea value={r.notes} onChange={(e) => update(i, { notes: e.target.value })} maxLength={2000} className="min-h-16" />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {r.photos.map((p) => (
                <span key={p} className="relative">
                  {previews[p] ? (
                    <a href={previews[p]} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private links */}
                      <img src={previews[p]} alt={`${r.room} photo`} className="size-20 rounded-[var(--radius-control)] border border-line object-cover" />
                    </a>
                  ) : (
                    <span className="flex size-20 items-center justify-center rounded-[var(--radius-control)] border border-line text-[11px] text-subtle">Photo</span>
                  )}
                  <button type="button" onClick={() => update(i, { photos: r.photos.filter((x) => x !== p) })} className="absolute -right-1 -top-1 size-6 rounded-full bg-ink text-[12px] font-bold text-white" aria-label="Remove photo">
                    ×
                  </button>
                </span>
              ))}
              {r.photos.length < 12 && (
                <label className={`inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-control)] border border-line-strong px-3 text-[13px] font-semibold ${uploading === r.id ? "opacity-60" : "hover:bg-surface-sunk"}`}>
                  {uploading === r.id ? "Uploading…" : "+ Photos"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" multiple className="sr-only" disabled={Boolean(uploading)} onChange={(e) => addPhotos(i, e.target.files)} />
                </label>
              )}
            </div>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => setRooms((rs) => [...rs, { id: `n${Date.now()}${seq++}`, room: "", condition: "good", notes: "", photos: [] }])}>
          + Add a room
        </Button>
        <Field label="Overall notes">
          <Textarea name="notes" defaultValue={notes} maxLength={4000} placeholder="Keys returned, meter readings, anything that isn't one room" />
        </Field>
      </fieldset>
    </form>
  );
}
