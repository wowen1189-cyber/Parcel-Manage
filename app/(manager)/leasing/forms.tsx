"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import {
  addMember,
  createGuestCard,
  decideApplication,
  enterScreening,
  finishListingPhoto,
  resendInvite,
  saveListing,
  scheduleShowing,
  sendApplicationLink,
  startListingPhoto,
  updateGuestCard,
  writeDescription,
  type LeasingState,
} from "./actions";

const empty: LeasingState = {};

function Status({ state }: { state: LeasingState }) {
  return (
    <>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      {state.link && (
        <div className="flex gap-2">
          <Input readOnly value={state.link} onFocus={(e) => e.currentTarget.select()} aria-label="Application link" />
          <Button type="button" small variant="secondary" onClick={() => navigator.clipboard.writeText(state.link!)}>
            Copy
          </Button>
        </div>
      )}
    </>
  );
}

type Listing = { headline: string; description: string; rent_cents: number; deposit_cents: number | null; available_on: string | null; pets_allowed: boolean; amenities: string[]; status: string } | null;

export function ListingForm({ unitId, listing, defaults }: { unitId: string; listing: Listing; defaults: { headline: string; rentCents: number | null } }) {
  const [state, action, pending] = useActionState(saveListing, empty);
  const [ai, aiAction, aiPending] = useActionState(writeDescription, empty);
  const [description, setDescription] = useState(listing?.description ?? "");
  const [lastDraft, setLastDraft] = useState<string | undefined>();
  if (ai.draft && ai.draft !== lastDraft) {
    setLastDraft(ai.draft);
    setDescription(ai.draft);
  }
  const $ = (c: number | null | undefined) => (c ? (c / 100).toFixed(2) : "");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="unit_id" value={unitId} />
      <Status state={state} />
      <Field label="Headline">
        <Input name="headline" defaultValue={listing?.headline ?? defaults.headline} maxLength={90} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Asking rent ($/month)">
          <Input name="rent" inputMode="decimal" defaultValue={$(listing?.rent_cents ?? defaults.rentCents)} />
        </Field>
        <Field label="Deposit ($)" hint="Optional. Shown as 'from' this amount.">
          <Input name="deposit" inputMode="decimal" defaultValue={$(listing?.deposit_cents)} />
        </Field>
        <Field label="Available">
          <Input type="date" name="available_on" defaultValue={listing?.available_on ?? ""} />
        </Field>
      </div>
      <Field label="Features" hint="Separate with commas: washer/dryer, fenced yard, new floors">
        <Input name="amenities" defaultValue={listing?.amenities.join(", ") ?? ""} />
      </Field>
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" name="pets_allowed" defaultChecked={listing?.pets_allowed ?? true} className="size-4" />
        Pets allowed (assistance animals are always allowed and are not pets)
      </label>
      <Field label="Description">
        <Textarea name="description" rows={7} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {ai.error && <Notice tone="warn">{ai.error}</Notice>}
      {ai.message && <Notice>{ai.message}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" small name="intent" value="save" disabled={pending}>
          Save
        </Button>
        {listing?.status === "published" ? (
          <Button type="submit" small variant="secondary" name="intent" value="unpublish" disabled={pending}>
            Take off rentals page
          </Button>
        ) : (
          <Button type="submit" small variant="secondary" name="intent" value="publish" disabled={pending}>
            Publish
          </Button>
        )}
        <Button type="submit" small variant="secondary" formAction={aiAction} disabled={aiPending}>
          {aiPending ? "Writing…" : description ? "Rewrite with AI" : "Write with AI"}
        </Button>
      </div>
    </form>
  );
}

export function ListingPhotos({ unitId }: { unitId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }).storage;
    for (const file of Array.from(files).slice(0, 12)) {
      const start = await startListingPhoto({ unitId, type: file.type, size: file.size });
      if (!start.path || !start.token) {
        setError(start.error ?? "The upload couldn't start.");
        break;
      }
      const up = await storage.from("documents").uploadToSignedUrl(start.path, start.token, file, { contentType: file.type });
      if (up.error) {
        setError("A photo didn't upload. Please try again.");
        break;
      }
      await finishListingPhoto({ unitId, path: start.path });
    }
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="space-y-2">
      {error && <Notice tone="danger">{error}</Notice>}
      <label className={`inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 text-[14px] font-semibold ${busy ? "opacity-60" : "hover:bg-surface-sunk"}`}>
        {busy ? "Uploading…" : "+ Add photos"}
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files)} />
      </label>
    </div>
  );
}

export function SendLinkForm({ unitId, units, guest }: { unitId?: string; units?: { id: string; name: string }[]; guest?: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; unit_id: string | null } }) {
  const [state, action, pending] = useActionState(sendApplicationLink, empty);
  return (
    <form action={action} className="space-y-3">
      <Status state={state} />
      {guest && <input type="hidden" name="guest_card_id" value={guest.id} />}
      {unitId ? (
        <input type="hidden" name="unit_id" value={unitId} />
      ) : (
        <Field label="Unit">
          <Select name="unit_id" defaultValue={guest?.unit_id ?? ""}>
            <option value="">Choose…</option>
            {units?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name">
          <Input name="first_name" defaultValue={guest?.first_name ?? ""} />
        </Field>
        <Field label="Last name">
          <Input name="last_name" defaultValue={guest?.last_name ?? ""} />
        </Field>
        <Field label="E-mail" hint="We e-mail the link here.">
          <Input name="email" type="email" defaultValue={guest?.email ?? ""} />
        </Field>
        <Field label="Mobile" hint="Optional">
          <Input name="phone" defaultValue={guest?.phone ?? ""} />
        </Field>
      </div>
      <Button type="submit" small disabled={pending}>
        {pending ? "Sending…" : "Send application link"}
      </Button>
    </form>
  );
}

type Guest = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; unit_id: string | null; source: string; desired_move_in: string | null; notes: string; status: string };

export function GuestCardForm({ guest, units, sources, statuses }: { guest?: Guest; units: { id: string; name: string }[]; sources: Record<string, string>; statuses: Record<string, string> }) {
  const [state, action, pending] = useActionState(guest ? updateGuestCard : createGuestCard, empty);
  return (
    <form action={action} className="space-y-3">
      {guest && <input type="hidden" name="id" value={guest.id} />}
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name">
          <Input name="first_name" defaultValue={guest?.first_name} />
        </Field>
        <Field label="Last name">
          <Input name="last_name" defaultValue={guest?.last_name} />
        </Field>
        <Field label="E-mail">
          <Input name="email" type="email" defaultValue={guest?.email ?? ""} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={guest?.phone ?? ""} />
        </Field>
        <Field label="Interested in">
          <Select name="unit_id" defaultValue={guest?.unit_id ?? ""}>
            <option value="">Any / not sure</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="How they found us">
          <Select name="source" defaultValue={guest?.source ?? "phone"}>
            {Object.entries(sources).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Wants to move in">
          <Input type="date" name="desired_move_in" defaultValue={guest?.desired_move_in ?? ""} />
        </Field>
        {guest && (
          <Field label="Status">
            <Select name="status" defaultValue={guest.status}>
              {Object.entries(statuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <Field label="Notes">
        <Textarea name="notes" rows={3} defaultValue={guest?.notes ?? ""} />
      </Field>
      <Button type="submit" small disabled={pending}>
        {pending ? "Saving…" : guest ? "Save" : "Add guest card"}
      </Button>
    </form>
  );
}

export function ShowingForm({ guestId, unitId, units }: { guestId: string; unitId: string | null; units: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(scheduleShowing, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="guest_card_id" value={guestId} />
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Unit">
          <Select name="unit_id" defaultValue={unitId ?? ""}>
            <option value="">Choose…</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date and time">
          <Input type="datetime-local" name="starts_at" />
        </Field>
      </div>
      <Field label="Notes" hint="Optional: gate code to share, who's showing it">
        <Input name="notes" />
      </Field>
      <Button type="submit" small disabled={pending}>
        {pending ? "Booking…" : "Book showing"}
      </Button>
    </form>
  );
}

type Report = { credit_score: number | null; eviction_years_ago: number | null; owes_landlord: boolean; utility_or_car_problems: boolean; criminal_records: boolean; agency_name: string | null; report_ref: string | null } | null;

export function ScreeningForm({ memberId, report }: { memberId: string; report: Report }) {
  const [state, action, pending] = useActionState(enterScreening, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="member_id" value={memberId} />
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Credit score" hint="Leave blank if there's no score.">
          <Input name="credit_score" inputMode="numeric" defaultValue={report?.credit_score ?? ""} />
        </Field>
        <Field label="Most recent eviction (years ago)" hint="Leave blank if none.">
          <Input name="eviction_years_ago" inputMode="decimal" defaultValue={report?.eviction_years_ago ?? ""} />
        </Field>
        <Field label="Screening company">
          <Input name="agency_name" defaultValue={report?.agency_name ?? ""} placeholder="TransUnion" />
        </Field>
        <Field label="Report number" hint="Optional">
          <Input name="report_ref" defaultValue={report?.report_ref ?? ""} />
        </Field>
      </div>
      <div className="space-y-2 text-[14px]">
        {(
          [
            ["owes_landlord", "Owes money to a past landlord", report?.owes_landlord],
            ["utility_or_car_problems", "Late or unpaid utility or car payments", report?.utility_or_car_problems],
            ["criminal_records", "Anything on the criminal report", report?.criminal_records],
          ] as const
        ).map(([name, label, on]) => (
          <label key={name} className="flex items-center gap-2">
            <input type="checkbox" name={name} defaultChecked={Boolean(on)} className="size-4" />
            {label}
          </label>
        ))}
      </div>
      <Button type="submit" small disabled={pending}>
        {pending ? "Saving…" : "Save results"}
      </Button>
    </form>
  );
}

export function DecisionForm({ applicationId, suggested, depositDefaults, agency }: { applicationId: string; suggested: string; depositDefaults: Record<string, string>; agency: string }) {
  const [state, action, pending] = useActionState(decideApplication, empty);
  const [decision, setDecision] = useState(suggested === "review" ? "approve" : suggested);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="application_id" value={applicationId} />
      <Status state={state} />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-[13px] font-semibold text-ink-2">Your decision</legend>
        {(
          [
            ["approve", "Approve"],
            ["approve_higher_deposit", "Approve with higher deposit"],
            ["decline", "Decline"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] border border-line-strong px-3 has-[:checked]:border-accent has-[:checked]:bg-accent-softer">
            <input type="radio" name="decision" value={k} checked={decision === k} onChange={() => setDecision(k)} className="size-4" />
            {label}
          </label>
        ))}
      </fieldset>
      {decision !== "decline" && (
        <Field label="Security deposit ($)" hint={decision === "approve_higher_deposit" ? "From your criteria's higher-deposit range. A person sets the final number." : undefined}>
          <Input key={decision} name="deposit" inputMode="decimal" defaultValue={depositDefaults[decision]} />
        </Field>
      )}
      {decision !== "approve" && (
        <div className="space-y-3 rounded-[var(--radius-card)] bg-surface-muted p-4">
          <p className="text-[13px]">If the screening report played any part in this, federal law (FCRA) requires an adverse action notice naming the screening company. We send it for you.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Screening company">
              <Input name="agency_name" defaultValue={agency} />
            </Field>
            <Field label="Its address">
              <Input name="agency_address" />
            </Field>
            <Field label="Its phone">
              <Input name="agency_phone" />
            </Field>
          </div>
        </div>
      )}
      <Field label="Note for the file" hint="Optional. Not sent to the applicant.">
        <Textarea name="note" rows={2} />
      </Field>
      <Button type="submit" small disabled={pending}>
        {pending ? "Saving…" : "Save decision and notify"}
      </Button>
    </form>
  );
}

export function AddMemberForm({ applicationId }: { applicationId: string }) {
  const [state, action, pending] = useActionState(addMember, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="application_id" value={applicationId} />
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Role">
          <Select name="role" defaultValue="co_applicant">
            <option value="co_applicant">Co-applicant</option>
            <option value="guarantor">Guarantor</option>
          </Select>
        </Field>
        <Field label="First name">
          <Input name="first_name" />
        </Field>
        <Field label="Last name">
          <Input name="last_name" />
        </Field>
        <Field label="E-mail">
          <Input name="email" type="email" />
        </Field>
      </div>
      <Button type="submit" small variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Invite"}
      </Button>
    </form>
  );
}

export function ResendInvite({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState(resendInvite, empty);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="member_id" value={memberId} />
      <button className="text-[13px] font-semibold text-accent" disabled={pending}>
        {pending ? "Sending…" : "Send a new link"}
      </button>
      <Status state={state} />
    </form>
  );
}
