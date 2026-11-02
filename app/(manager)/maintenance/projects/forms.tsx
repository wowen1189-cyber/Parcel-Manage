"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { PROJECT_STATUS } from "@/lib/projects";
import { createProject, createPurchaseOrder, updateProject, type ProjectState } from "./actions";

const empty: ProjectState = {};

export function NewProjectForm({ properties }: { properties: { id: string; name: string; units: { id: string; label: string }[] }[] }) {
  const [state, action, pending] = useActionState(createProject, empty);
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  const [propertyId, setPropertyId] = useState(v("property_id"));
  const units = properties.find((p) => p.id === propertyId)?.units ?? [];
  return (
    <form action={action} className="space-y-4 p-5">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project">
          <Input name="name" defaultValue={v("name")} placeholder="Unit 2 turn" required />
        </Field>
        <Field label="Budget ($)">
          <Input name="budget" inputMode="decimal" defaultValue={v("budget")} placeholder="12,500" required />
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
        <Field label="Unit (optional)">
          <Select name="unit_id" defaultValue={v("unit_id")} key={propertyId}>
            <option value="">Whole property</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start">
          <Input type="date" name="start_on" defaultValue={v("start_on")} />
        </Field>
        <Field label="Finish by">
          <Input type="date" name="target_on" defaultValue={v("target_on")} />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <Textarea name="notes" defaultValue={v("notes")} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add project"}
        </Button>
      </div>
    </form>
  );
}

export function ProjectSettingsForm({ id, status, budget, targetOn }: { id: string; status: string; budget: string; targetOn: string }) {
  const [state, action, pending] = useActionState(updateProject, empty);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 p-5">
      <input type="hidden" name="id" value={id} />
      <Field label="Status">
        <Select name="status" defaultValue={status}>
          {Object.entries(PROJECT_STATUS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Budget ($)">
        <Input name="budget" inputMode="decimal" defaultValue={budget} />
      </Field>
      <Field label="Finish by">
        <Input type="date" name="target_on" defaultValue={targetOn} />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        Save
      </Button>
      {state.error && <span className="text-[13px] text-danger">{state.error}</span>}
      {state.message && <span className="text-[13px] text-subtle">{state.message}</span>}
    </form>
  );
}

export function NewPurchaseOrderForm({ projectId, vendors }: { projectId: string; vendors: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createPurchaseOrder, empty);
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  return (
    <form action={action} className="space-y-3 border-t border-line p-5" key={state.message}>
      <input type="hidden" name="project_id" value={projectId} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_140px_auto] sm:items-end">
        <Field label="Vendor">
          <Select name="vendor_id" defaultValue={v("vendor_id")}>
            <option value="">Choose…</option>
            {vendors.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="For">
          <Input name="description" defaultValue={v("description")} placeholder="Replace kitchen cabinets, labor and materials" />
        </Field>
        <Field label="Amount ($)">
          <Input name="amount" inputMode="decimal" defaultValue={v("amount")} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Writing…" : "Write PO"}
        </Button>
      </div>
    </form>
  );
}
