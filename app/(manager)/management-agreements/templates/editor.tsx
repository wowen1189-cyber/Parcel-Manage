"use client";

import { useActionState, useRef, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { PART_WHEN, type Part } from "@/lib/agreement-templates";
import { saveTemplate, type TemplateState } from "./actions";

const empty: TemplateState = {};
let next = 0;
const newId = () => `n${Date.now().toString(36)}${next++}`;

// Edit a company's agreement template: parts with a heading, text and an optional "only when" rule, and a
// picker that drops a fill-in blank ({{field}}) at the cursor in the last text box you clicked.
export function TemplateEditor({ id, name, parts: initial, fields, canEdit }: { id: string; name: string; parts: Part[]; fields: { key: string; label: string }[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveTemplate, empty);
  const [parts, setParts] = useState<Part[]>(initial);
  const last = useRef<{ index: number; el: HTMLTextAreaElement } | null>(null);
  const blanks = parts.reduce((n, p) => n + (p.body.match(/_{4,}/g)?.length ?? 0), 0);

  const update = (i: number, change: Partial<Part>) => setParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...change } : p)));
  const move = (i: number, by: number) =>
    setParts((ps) => {
      const j = i + by;
      if (j < 0 || j >= ps.length) return ps;
      const copy = [...ps];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const insert = (key: string) => {
    if (!key || !last.current) return;
    const { index, el } = last.current;
    const at = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? at;
    const text = `{{${key}}}`;
    // Replacing a selected "_____" blank is the usual case.
    update(index, { body: el.value.slice(0, at) + text + el.value.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at + text.length, at + text.length);
    });
  };

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="parts" value={JSON.stringify(parts)} />
      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="sticky top-0 z-10 -mx-1 space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-sm">
          {state.error && <Notice tone="danger">{state.error}</Notice>}
          {state.message && <Notice tone="success">{state.message}</Notice>}
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Template name">
              <Input name="name" defaultValue={name} required maxLength={120} />
            </Field>
            <Field label="Insert a blank" hint="Click in the text first (or select a ____ line), then pick.">
              <Select value="" onChange={(e) => insert(e.target.value)} aria-label="Insert a fill-in blank">
                <option value="">Choose what fills in…</option>
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save template"}
            </Button>
          </div>
          {blanks > 0 && <p className="text-[13px] text-warn">{blanks} blank line{blanks === 1 ? "" : "s"} (____) left. Replace each with a fill-in blank, or the agreement will print the line empty.</p>}
        </div>

        <p className="text-[13px] text-subtle">
          A blank line starts a new paragraph. Start a line with “- ” for a list item. Wrap words in **double stars** for bold. The owner&apos;s and your signature lines are added at the end automatically, so remove your old signature section.
        </p>

        {parts.map((p, i) => (
          <div key={p.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Field label={`Part ${i + 1} heading`} hint="Leave empty to continue the part above">
                <Input value={p.heading} onChange={(e) => update(i, { heading: e.target.value })} maxLength={200} />
              </Field>
              <Field label="Include">
                <Select value={p.when ?? ""} onChange={(e) => update(i, { when: (e.target.value || null) as Part["when"] })}>
                  <option value="">Always</option>
                  {Object.entries(PART_WHEN).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Text">
              <Textarea
                value={p.body}
                rows={Math.min(24, Math.max(4, Math.ceil(p.body.length / 90) + p.body.split("\n").length))}
                onChange={(e) => update(i, { body: e.target.value })}
                onFocus={(e) => (last.current = { index: i, el: e.currentTarget })}
                onSelect={(e) => (last.current = { index: i, el: e.currentTarget })}
                className="font-serif text-[15px] leading-relaxed"
              />
            </Field>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" small variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move part ${i + 1} up`}>
                ↑ Up
              </Button>
              <Button type="button" small variant="ghost" onClick={() => move(i, 1)} disabled={i === parts.length - 1} aria-label={`Move part ${i + 1} down`}>
                ↓ Down
              </Button>
              <Button type="button" small variant="ghost" onClick={() => setParts((ps) => [...ps.slice(0, i + 1), { id: newId(), heading: "", body: "", when: null }, ...ps.slice(i + 1)])}>
                + Add a part below
              </Button>
              <Button type="button" small variant="ghost" onClick={() => setParts((ps) => ps.filter((_, j) => j !== i))} aria-label={`Remove part ${i + 1}`}>
                Remove
              </Button>
            </div>
          </div>
        ))}
        {!parts.length && (
          <Button type="button" variant="secondary" onClick={() => setParts([{ id: newId(), heading: "", body: "", when: null }])}>
            + Add a part
          </Button>
        )}
      </fieldset>
    </form>
  );
}
