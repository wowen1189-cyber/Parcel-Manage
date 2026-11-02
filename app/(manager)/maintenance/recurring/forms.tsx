"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { MAINTENANCE_FREQUENCY } from "@/lib/recurring-maintenance-rules";
import { createDueNow, createSchedule, type RecurringState } from "./actions";

const empty: RecurringState = {};

export function NewScheduleForm({ properties, vendors, today }: { properties: { id: string; name: string; units: { id: string; label: string }[] }[]; vendors: { id: string; name: string }[]; today: string }) {
  const [state, action, pending] = useActionState(createSchedule, empty);
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  const [propertyId, setPropertyId] = useState(v("property_id"));
  const units = properties.find((p) => p.id === propertyId)?.units ?? [];
  return (
    <form action={action} className="space-y-4 p-5">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What's done">
          <Input name="title" defaultValue={v("title")} placeholder="Replace AC filter" required />
        </Field>
        <Field label="How often">
          <Select name="frequency" defaultValue={v("frequency", "quarterly")}>
            {Object.entries(MAINTENANCE_FREQUENCY).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Property">
          <Select name="property_id" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} required>
            <option value="">Choose…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unit" hint="Leave as the whole property for common areas">
          <Select name="unit_id" defaultValue={v("unit_id")} key={propertyId}>
            <option value="">Whole property</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Usual vendor (optional)">
          <Select name="vendor_id" defaultValue={v("vendor_id")}>
            <option value="">None yet</option>
            {vendors.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="First date">
          <Input type="date" name="next_on" defaultValue={v("next_on", today)} min={today} required />
        </Field>
      </div>
      <Field label="Details for the vendor (optional)">
        <Textarea name="details" defaultValue={v("details")} placeholder="Filter size 20x25x1, closet by the hall bath" />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add schedule"}
        </Button>
      </div>
    </form>
  );
}

export function DueNowButton() {
  const [state, action, pending] = useActionState(createDueNow, empty);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      {state.message && <span className="text-[13px] text-subtle">{state.message}</span>}
      {state.error && <span className="text-[13px] text-danger">{state.error}</span>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Creating…" : "Create what's due now"}
      </Button>
    </form>
  );
}
