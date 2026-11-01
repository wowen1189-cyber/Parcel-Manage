"use client";

import { useActionState, useState } from "react";
import { Button, Card, CardHeader, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { PROPERTY_TYPE_LABEL } from "@/lib/format";
import { MAX_OWNERS } from "@/lib/property-form";
import { updateProperty, type FormState } from "./actions";

type PropertyValues = {
  id: string;
  name: string;
  property_type: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  county: string | null;
  year_built: number | null;
  entity_id: string;
  notes: string | null;
};

const empty: FormState = {};

export function PropertyForm({
  property,
  entities,
  owners,
  canEdit,
}: {
  property: PropertyValues;
  entities: { id: string; name: string }[];
  owners: { name: string; pct: number }[];
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(updateProperty, empty);
  const v = (key: keyof PropertyValues) => state.values?.[key] ?? (property[key] == null ? "" : String(property[key]));
  const [entity, setEntity] = useState(v("entity_id"));
  const ownerValue = (i: number, field: "name" | "pct") =>
    state.values?.[`owner_${field}_${i}`] ?? (owners[i] ? String(owners[i][field]) : "");
  const [rows, setRows] = useState(Math.max(owners.length + 1, 2));
  const [pcts, setPcts] = useState(() => Array.from({ length: MAX_OWNERS }, (_, i) => ownerValue(i, "pct")));
  const total = Number(pcts.slice(0, rows).reduce((s, p) => s + (Number(p) || 0), 0).toFixed(3));

  return (
    <form action={action}>
      <input type="hidden" name="id" value={property.id} />
      <Card>
        <CardHeader title="Property details" description="Address, type, the LLC that owns it and each owner's share." />
        <fieldset disabled={!canEdit} className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            {state.error && <Notice tone="danger">{state.error}</Notice>}
            {state.message && <Notice tone="success">{state.message}</Notice>}
            {!canEdit && <Notice>Only an admin or property manager can change properties.</Notice>}
          </div>
          <Field label="Property name">
            <Input name="name" required defaultValue={v("name")} />
          </Field>
          <Field label="Type">
            <Select name="property_type" defaultValue={v("property_type")}>
              {Object.entries(PROPERTY_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Street address">
            <Input name="address_line1" defaultValue={v("address_line1")} autoComplete="address-line1" />
          </Field>
          <Field label="Suite or building (optional)">
            <Input name="address_line2" defaultValue={v("address_line2")} autoComplete="address-line2" />
          </Field>
          <div className="grid grid-cols-[1fr_80px_120px] gap-3 sm:col-span-2">
            <Field label="City">
              <Input name="city" defaultValue={v("city")} autoComplete="address-level2" />
            </Field>
            <Field label="State">
              <Input name="state" maxLength={2} defaultValue={v("state")} autoComplete="address-level1" />
            </Field>
            <Field label="ZIP">
              <Input name="postal_code" inputMode="numeric" defaultValue={v("postal_code")} autoComplete="postal-code" />
            </Field>
          </div>
          <Field label="County" hint="Used on Florida notices and court filings.">
            <Input name="county" defaultValue={v("county")} />
          </Field>
          <Field label="Year built" hint="Homes built before 1978 need the lead-paint disclosure.">
            <Input name="year_built" inputMode="numeric" maxLength={4} defaultValue={v("year_built")} />
          </Field>

          <Field label="Owning LLC">
            <Select name="entity_id" value={entity} onChange={(e) => setEntity(e.target.value)}>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
              <option value="new">+ Add a new LLC…</option>
            </Select>
          </Field>
          {entity === "new" ? (
            <Field label="New LLC name">
              <Input name="new_entity_name" defaultValue={state.values?.new_entity_name} placeholder="e.g. 1026 W Line St LLC" />
            </Field>
          ) : (
            <div />
          )}

          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">Owners and their share</legend>
            <div className="space-y-2">
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px] gap-3">
                  <Input name={`owner_name_${i}`} defaultValue={ownerValue(i, "name")} placeholder="Owner name" aria-label={`Owner ${i + 1} name`} />
                  <div className="flex items-center gap-1">
                    <Input name={`owner_pct_${i}`} inputMode="decimal" defaultValue={ownerValue(i, "pct")} placeholder="0" aria-label={`Owner ${i + 1} percent`} onChange={(e) => setPcts((p) => p.map((x, j) => (j === i ? e.target.value : x)))} className="text-right" />
                    <span className="text-muted">%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[13px]">
              {rows < MAX_OWNERS ? (
                <button type="button" onClick={() => setRows(rows + 1)} className="font-semibold text-accent hover:underline">
                  + Add an owner
                </button>
              ) : (
                <span />
              )}
              <span className={total === 0 || total === 100 ? "text-subtle" : "font-semibold text-warn"} aria-live="polite">
                Total {total}%{total !== 0 && total !== 100 ? " (must be 100%)" : ""}
              </span>
            </div>
          </fieldset>

          <Field label="Notes">
            <Textarea name="notes" defaultValue={v("notes")} />
          </Field>
          <div className="flex items-end justify-end sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save property"}
            </Button>
          </div>
        </fieldset>
      </Card>
    </form>
  );
}
