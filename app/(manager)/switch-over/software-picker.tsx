"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";

const OTHER = "__other";

// "Moving from": a plain dropdown of the usual software, plus "Something else…" to type a name.
// Uncontrolled, and remounted (key) when the saved value changes, because the form resets after saving.
export function SoftwarePicker({ options, current }: { options: string[]; current: string | null }) {
  const initial = current ? (options.includes(current) ? current : OTHER) : "";
  const [choice, setChoice] = useState(initial);
  return (
    <>
      <Field label="Moving from" hint="The software (or spreadsheet) you're leaving. The checklist uses its name.">
        <Select name="choice" defaultValue={initial} onChange={(e) => setChoice(e.target.value)} className="w-72">
          <option value="">Choose…</option>
          {options.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
          <option value={OTHER}>Something else…</option>
        </Select>
      </Field>
      {choice === OTHER && (
        <Field label="Its name">
          <Input name="other" defaultValue={current && !options.includes(current) ? current : ""} placeholder="Name of the software" className="w-60" autoFocus />
        </Field>
      )}
    </>
  );
}
