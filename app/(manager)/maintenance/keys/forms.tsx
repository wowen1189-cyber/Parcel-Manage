"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { addItem, addKeySet, checkOutKey, moveStock, type KeysState } from "./actions";

const empty: KeysState = {};
const Msg = ({ s }: { s: KeysState }) => (s.error ? <span className="text-[13px] text-danger">{s.error}</span> : s.message ? <span className="text-[13px] text-subtle">{s.message}</span> : null);

export function AddKeyForm({ properties }: { properties: { id: string; name: string; units: { id: string; label: string }[] }[] }) {
  const [state, action, pending] = useActionState(addKeySet, empty);
  const [propertyId, setPropertyId] = useState("");
  const units = properties.find((p) => p.id === propertyId)?.units ?? [];
  return (
    <form action={action} className="space-y-3 border-t border-line p-5" key={state.message}>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <div className="grid gap-3 sm:grid-cols-3">
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
        <Field label="Unit">
          <Select name="unit_id" key={propertyId}>
            <option value="">Whole property</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Which key">
          <Input name="label" placeholder="Front door" required />
        </Field>
        <Field label="Tag number" hint="The number on the key tag. Never a door code.">
          <Input name="tag" placeholder="K-104" />
        </Field>
        <Field label="Copies">
          <Input name="copies" inputMode="numeric" defaultValue="1" />
        </Field>
        <Field label="Kept where">
          <Input name="location" placeholder="Office key box" />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3">
        <Msg s={state} />
        <Button type="submit" disabled={pending}>
          Add key
        </Button>
      </div>
    </form>
  );
}

export function CheckOutForm({ keySetId, today }: { keySetId: string; today: string }) {
  const [state, action, pending] = useActionState(checkOutKey, empty);
  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="key_set_id" value={keySetId} />
      <Input name="holder" placeholder="Who's taking it" aria-label="Who's taking the key" className="w-44" />
      <Input type="date" name="due_back_on" min={today} aria-label="Due back" className="w-40" />
      <Button type="submit" small variant="secondary" disabled={pending}>
        Check out
      </Button>
      <Msg s={state} />
    </form>
  );
}

export function AddItemForm() {
  const [state, action, pending] = useActionState(addItem, empty);
  return (
    <form action={action} className="space-y-3 border-t border-line p-5" key={state.message}>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <div className="grid gap-3 sm:grid-cols-5">
        <Field label="Item">
          <Input name="name" placeholder="20x25x1 AC filter" required />
        </Field>
        <Field label="Kept where">
          <Input name="location" placeholder="Shop shelf B" />
        </Field>
        <Field label="On hand">
          <Input name="quantity" inputMode="numeric" defaultValue="0" />
        </Field>
        <Field label="Reorder at">
          <Input name="reorder_at" inputMode="numeric" defaultValue="0" />
        </Field>
        <Field label="Cost each ($)">
          <Input name="unit_cost" inputMode="decimal" placeholder="12.50" />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3">
        <Msg s={state} />
        <Button type="submit" disabled={pending}>
          Add item
        </Button>
      </div>
    </form>
  );
}

export function StockForm({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState(moveStock, empty);
  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-2" key={state.message}>
      <input type="hidden" name="item_id" value={itemId} />
      <Select name="direction" aria-label="Received or used" className="w-28">
        <option value="out">Used</option>
        <option value="in">Received</option>
      </Select>
      <Input name="qty" inputMode="numeric" placeholder="Qty" aria-label="How many" className="w-20" />
      <Input name="work_order" inputMode="numeric" placeholder="WO #" aria-label="Work order number (optional)" className="w-24" />
      <Button type="submit" small variant="secondary" disabled={pending}>
        Save
      </Button>
      <Msg s={state} />
    </form>
  );
}
