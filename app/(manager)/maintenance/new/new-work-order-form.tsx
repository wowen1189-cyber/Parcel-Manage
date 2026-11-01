"use client";

import { useActionState, useState } from "react";
import { Button, Card, CardHeader, Field, Input, Notice, Pill, Select, Textarea } from "@/components/ui";
import { ROOMS, SAFETY_OPTIONS, TRIAGE_CATEGORIES, findSymptom, tipsFor, triagePriority, visibleQuestions } from "@/lib/triage";
import { createWorkOrder, type FormState } from "../actions";

export type PropertyOption = { id: string; name: string; units: { id: string; label: string; tenants: { id: string; name: string }[] }[] };

const empty: FormState = {};
const chip = (on: boolean) =>
  `min-h-11 rounded-[var(--radius-control)] border px-3 py-2 text-left text-sm ${on ? "border-accent bg-accent-softer font-semibold text-accent-deep" : "border-line-strong bg-surface hover:bg-surface-sunk"}`;
const TONE = { Routine: "neutral", Urgent: "warn", Emergency: "danger" } as const;

export function NewWorkOrderForm({ properties, officePhone, defaultPropertyId, defaultUnitId }: { properties: PropertyOption[]; officePhone: string; defaultPropertyId: string; defaultUnitId: string }) {
  const [state, action, pending] = useActionState(createWorkOrder, empty);
  const [propertyId, setPropertyId] = useState(state.values?.property_id ?? defaultPropertyId);
  const [unitId, setUnitId] = useState(state.values?.unit_id ?? defaultUnitId);
  const [safety, setSafety] = useState(state.values?.safety ?? "");
  const [category, setCategory] = useState(state.values?.category ?? "");
  const [item, setItem] = useState(state.values?.item ?? "");
  const [symptom, setSymptom] = useState(state.values?.symptom ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const property = properties.find((p) => p.id === propertyId);
  const unit = property?.units.find((u) => u.id === unitId);
  const cat = TRIAGE_CATEGORIES.find((c) => c.id === category);
  const it = cat?.items.find((i) => i.id === item);
  const found = findSymptom(category, item, symptom);
  const questions = found ? visibleQuestions(found.symptom, answers) : [];
  const result = found ? triagePriority(found.symptom, answers) : null;
  const tips = found ? tipsFor(found.symptom, answers) : [];
  const safetyOption = SAFETY_OPTIONS.find((o) => o.id === safety);
  const priority = safety ? "Emergency" : result?.priority;

  return (
    <form action={action} className="space-y-6">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <input type="hidden" name="safety" value={safety} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="item" value={item} />
      <input type="hidden" name="symptom" value={symptom} />
      {Object.entries(answers).map(([q, a]) => (
        <input key={q} type="hidden" name={`q_${q}`} value={a} />
      ))}

      <Card>
        <CardHeader title="Where" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Property">
            <Select name="property_id" value={propertyId} onChange={(e) => (setPropertyId(e.target.value), setUnitId(""))}>
              <option value="">Choose…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Unit">
            <Select name="unit_id" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">Common area / whole building</option>
              {property?.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reported by">
            <Select name="reported_by" defaultValue={state.values?.reported_by ?? ""}>
              <option value="">Staff / not a tenant</option>
              {unit?.tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="How it came in">
            <Select name="source" defaultValue={state.values?.source ?? "phone"}>
              <option value="phone">Phone call</option>
              <option value="email">Email</option>
              <option value="staff">Staff found it</option>
              <option value="inspection">Inspection</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Safety first" description="Ask these before anything else. Either one skips the questions." />
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {SAFETY_OPTIONS.map((o) => (
            <button key={o.id} type="button" onClick={() => setSafety(safety === o.id ? "" : o.id)} className={`${chip(safety === o.id)} ${safety === o.id ? "!border-danger !bg-danger-bg !text-danger" : ""}`}>
              <span className="font-semibold">{o.label}</span>
            </button>
          ))}
        </div>
        {safetyOption && (
          <div className="px-5 pb-5">
            <Notice tone="danger">
              <span className="font-bold">Tell them now: </span>
              {safetyOption.screen.replace("{officePhone}", officePhone)}
            </Notice>
          </div>
        )}
      </Card>

      {!safety && (
        <Card>
          <CardHeader title="What's wrong" description="Priority comes from the answers, the same way tenants will report it in their portal." action={priority && <Pill tone={TONE[priority]}>{priority}</Pill>} />
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap gap-2">
              {TRIAGE_CATEGORIES.map((c) => (
                <button key={c.id} type="button" className={chip(category === c.id)} onClick={() => (setCategory(c.id), setItem(""), setSymptom(""), setAnswers({}))}>
                  {c.label}
                  {c.sub && <span className="block text-[12px] font-normal text-subtle">{c.sub}</span>}
                </button>
              ))}
            </div>
            {cat && (
              <div>
                <p className="mb-2 text-[13px] font-semibold text-ink-2">{cat.itemQuestion ?? "Which one?"}</p>
                <div className="flex flex-wrap gap-2">
                  {cat.items.map((i) => (
                    <button key={i.id} type="button" className={chip(item === i.id)} onClick={() => (setItem(i.id), setSymptom(""), setAnswers({}))}>
                      {i.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {it && (
              <div>
                <p className="mb-2 text-[13px] font-semibold text-ink-2">What&apos;s happening?</p>
                <div className="flex flex-wrap gap-2">
                  {it.symptoms.map((s) => (
                    <button key={s.id} type="button" className={chip(symptom === s.id)} onClick={() => (setSymptom(s.id), setAnswers({}))}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {questions.map((q) => (
              <fieldset key={q.id}>
                <legend className="mb-2 text-[13px] font-semibold text-ink-2">{q.question}</legend>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((o) => (
                    <button key={o} type="button" className={chip(answers[q.id] === o)} onClick={() => setAnswers({ ...answers, [q.id]: o })}>
                      {o}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
            {result && result.reasons.length > 0 && <Notice tone={result.priority === "Emergency" ? "danger" : "warn"}>{result.reasons.join(" ")}</Notice>}
            {tips.length > 0 && (
              <div className="rounded-[var(--radius-control)] bg-surface-muted px-4 py-3">
                <p className="text-[13px] font-semibold text-ink-2">Self-checks to suggest</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-muted">
                  {tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Details" />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          {!safety && (
            <div className="sm:col-span-3">
              <Field label="Title (optional)" hint="Filled in from the problem if left blank">
                <Input name="title" defaultValue={state.values?.title} />
              </Field>
            </div>
          )}
          <Field label="Room">
            <Select name="room" defaultValue={state.values?.room ?? ""}>
              <option value="">Not given</option>
              {ROOMS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="OK to enter if no one is home?">
            <Select name="entry_ok" defaultValue={state.values?.entry_ok ?? ""}>
              <option value="">Not asked</option>
              <option value="yes">Yes</option>
              <option value="no">No, wants to be home</option>
            </Select>
          </Field>
          <Field label="Pets in the home?">
            <Select name="pets" defaultValue={state.values?.pets ?? ""}>
              <option value="">Not asked</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </Field>
          <div className="sm:col-span-3">
            <Field label="Notes">
              <Textarea name="tenant_note" defaultValue={state.values?.tenant_note} placeholder="Anything else the vendor should know" />
            </Field>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {priority && (
          <span className="text-sm">
            Priority: <Pill tone={TONE[priority]}>{priority}</Pill>
          </span>
        )}
        <Button type="submit" disabled={pending || !propertyId || (!safety && !found)}>
          {pending ? "Saving…" : "Create work order"}
        </Button>
      </div>
    </form>
  );
}
