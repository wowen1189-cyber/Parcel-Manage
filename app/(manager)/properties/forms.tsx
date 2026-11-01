"use client";

import { useActionState, useState } from "react";
import { Button, Card, CardHeader, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { PROPERTY_TYPE_LABEL } from "@/lib/format";
import { MAX_OWNERS } from "@/lib/property-form";
import { createProperty, saveUnit, updateProperty, type FormState } from "./actions";

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

// ---------- new property ----------

export function NewPropertyForm({ entities }: { entities: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createProperty, empty);
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  const [entity, setEntity] = useState(v("entity_id", entities[0]?.id ?? "new"));
  return (
    <form action={action}>
      <Card>
        <CardHeader title="Property" description="Single-family homes get their one unit automatically. For buildings, add units on the next page." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">{state.error && <Notice tone="danger">{state.error}</Notice>}</div>
          <Field label="Property name" hint="What your team calls it, e.g. The Grove Tower or 6 Forest Lane">
            <Input name="name" required defaultValue={v("name")} />
          </Field>
          <Field label="Type">
            <Select name="property_type" defaultValue={v("property_type", "multi_family")}>
              {Object.entries(PROPERTY_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Street address">
            <Input name="address_line1" required defaultValue={v("address_line1")} autoComplete="address-line1" />
          </Field>
          <Field label="Suite or building (optional)">
            <Input name="address_line2" defaultValue={v("address_line2")} />
          </Field>
          <div className="grid grid-cols-[1fr_80px_120px] gap-3 sm:col-span-2">
            <Field label="City">
              <Input name="city" required defaultValue={v("city")} />
            </Field>
            <Field label="State">
              <Input name="state" required maxLength={2} defaultValue={v("state", "FL")} />
            </Field>
            <Field label="ZIP">
              <Input name="postal_code" required inputMode="numeric" defaultValue={v("postal_code")} />
            </Field>
          </div>
          <Field label="County" hint="Used on Florida notices.">
            <Input name="county" defaultValue={v("county", "Lake")} />
          </Field>
          <Field label="Year built" hint="Built before 1978? The lead paint disclosure is added to its leases.">
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
              <Input name="new_entity_name" defaultValue={v("new_entity_name")} placeholder="e.g. 1026 W Line St LLC" />
            </Field>
          ) : (
            <div />
          )}
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add property"}
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}

// ---------- units ----------

export type UnitValues = {
  id: string;
  label: string;
  kind: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  market_rent_cents: number | null;
  status: string;
  amenities: string[];
  notes: string | null;
};

export function UnitForm({ propertyId, unit, defaultKind, canEdit }: { propertyId: string; unit?: UnitValues; defaultKind: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveUnit, empty);
  const v = (k: keyof UnitValues, d = "") => state.values?.[k] ?? (unit?.[k] == null ? d : Array.isArray(unit[k]) ? (unit[k] as string[]).join(", ") : String(unit[k]));
  const [kind, setKind] = useState(v("kind", defaultKind));
  return (
    <form action={action}>
      <input type="hidden" name="property_id" value={propertyId} />
      <input type="hidden" name="id" value={unit?.id ?? ""} />
      <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-4">
          {state.error && <Notice tone="danger">{state.error}</Notice>}
          {state.message && <Notice tone="success">{state.message}</Notice>}
        </div>
        <Field label="Unit">
          <Input name="label" required defaultValue={v("label")} placeholder="101, Suite B…" />
        </Field>
        <Field label="Kind" hint="Picks the lease and application">
          <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </Select>
        </Field>
        {kind === "residential" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Beds">
              <Input name="beds" inputMode="numeric" defaultValue={v("beds")} />
            </Field>
            <Field label="Baths">
              <Input name="baths" inputMode="decimal" defaultValue={v("baths")} />
            </Field>
          </div>
        ) : (
          <>
            <input type="hidden" name="beds" value="" />
            <input type="hidden" name="baths" value="" />
            <div />
          </>
        )}
        <Field label="Sq ft">
          <Input name="sqft" inputMode="numeric" defaultValue={v("sqft")} />
        </Field>
        <Field label="Market rent ($)">
          <Input name="market_rent" inputMode="decimal" defaultValue={unit?.market_rent_cents != null && !state.values ? (unit.market_rent_cents / 100).toFixed(2) : (state.values?.market_rent ?? "")} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={v("status", "vacant")}>
            <option value="vacant">Vacant</option>
            <option value="listed">Listed</option>
            <option value="down">Down (not rentable)</option>
            <option value="occupied">Occupied</option>
            <option value="notice">On notice</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Amenities" hint="Separate with commas">
            <Input name="amenities" defaultValue={v("amenities")} placeholder="Coin laundry, Lake access" />
          </Field>
        </div>
        <div className="sm:col-span-4">
          <Field label="Notes">
            <Input name="notes" defaultValue={v("notes")} />
          </Field>
        </div>
        <div className="flex justify-end sm:col-span-4">
          <Button type="submit" small disabled={pending}>
            {pending ? "Saving…" : unit ? "Save unit" : "Add unit"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
