"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice, Select, Textarea } from "@/components/ui";
import { ROOMS, SAFETY_OPTIONS, TRIAGE_CATEGORIES, findSymptom, tipsFor, triagePriority, visibleQuestions } from "@/lib/triage";
import { createRequest, type PortalState } from "../../actions";

const empty: PortalState = {};
const chip = (on: boolean) =>
  `min-h-12 w-full rounded-[var(--radius-control)] border px-4 py-2.5 text-left text-[15px] ${on ? "border-accent bg-accent-softer font-semibold text-accent-deep" : "border-line-strong bg-surface hover:bg-surface-sunk"}`;

// The tenant's guided request: safety first, then what's wrong, the questions that set priority, self-checks
// to try, and (for emergencies) the false-emergency acknowledgment. Same rules as the office form.
export function RequestForm({ officePhone, ackText }: { officePhone: string; ackText: string }) {
  const [state, action, pending] = useActionState(createRequest, empty);
  const [safety, setSafety] = useState("");
  const [category, setCategory] = useState("");
  const [item, setItem] = useState("");
  const [symptom, setSymptom] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const cat = TRIAGE_CATEGORIES.find((c) => c.id === category);
  const it = cat?.items.find((i) => i.id === item);
  const found = findSymptom(category, item, symptom);
  const questions = found ? visibleQuestions(found.symptom, answers) : [];
  const answeredAll = questions.every((q) => answers[q.id]);
  const result = found ? triagePriority(found.symptom, answers) : null;
  const tips = found ? tipsFor(found.symptom, answers) : [];
  const safetyOption = SAFETY_OPTIONS.find((o) => o.id === safety);
  const emergency = !safety && result?.priority === "Emergency";
  const ready = safety || (found && answeredAll);

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

      <section className="space-y-3">
        <h2 className="text-[17px] font-bold">Is anyone in danger?</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {SAFETY_OPTIONS.map((o) => (
            <button key={o.id} type="button" aria-pressed={safety === o.id} onClick={() => setSafety(safety === o.id ? "" : o.id)} className={`${chip(safety === o.id)} ${safety === o.id ? "!border-danger !bg-danger-bg !text-danger" : ""}`}>
              {o.label}
            </button>
          ))}
        </div>
        {safetyOption && (
          <Notice tone="danger">
            <span className="font-bold">Do this now: </span>
            {safetyOption.screen.replace("{officePhone}", officePhone)} When you&apos;re safe, tap Send below so we know.
          </Notice>
        )}
        {safetyOption && (
          <Button type="button" variant="secondary" onClick={() => setSafety("")}>
            Tapped by mistake? Go back
          </Button>
        )}
      </section>

      {!safety && (
        <section className="space-y-5">
          <h2 className="text-[17px] font-bold">What needs fixing?</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {TRIAGE_CATEGORIES.map((c) => (
              <button key={c.id} type="button" className={chip(category === c.id)} onClick={() => (setCategory(c.id), setItem(""), setSymptom(""), setAnswers({}))}>
                {c.label}
                {c.sub && <span className="block text-[13px] font-normal text-subtle">{c.sub}</span>}
              </button>
            ))}
          </div>
          {cat && (
            <div>
              <p className="mb-2 font-semibold">{cat.itemQuestion ?? "Which one?"}</p>
              <div className="grid gap-2 sm:grid-cols-2">
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
              <p className="mb-2 font-semibold">What&apos;s happening?</p>
              <div className="grid gap-2">
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
              <legend className="mb-2 font-semibold">{q.question}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((o) => (
                  <button key={o} type="button" className={chip(answers[q.id] === o)} onClick={() => setAnswers({ ...answers, [q.id]: o })}>
                    {o}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          {found && answeredAll && tips.length > 0 && (
            <div className="rounded-[var(--radius-card)] bg-info-bg px-4 py-3 text-info">
              <p className="font-semibold">Try this first. It might fix it right away:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-[14px]">
                {tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="mt-2 text-[13px]">Still not working? Send the request below.</p>
            </div>
          )}
        </section>
      )}

      {ready && (
        <section className="space-y-4">
          <h2 className="text-[17px] font-bold">A few details</h2>
          {!safety && (
            <Field label="Where in the home?">
              <Select name="room" defaultValue="">
                <option value="">Choose…</option>
                {ROOMS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Can a technician come in if you're not home?" hint="We always give notice first unless it's an emergency.">
            <Select name="entry_ok" defaultValue="">
              <option value="">Choose…</option>
              <option value="yes">Yes, that&apos;s fine</option>
              <option value="no">No, I want to be home</option>
            </Select>
          </Field>
          <Field label="Any pets in the home?">
            <Select name="pets" defaultValue="">
              <option value="">Choose…</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </Field>
          <Field label="Anything else we should know?" hint="Optional. You can add photos after you send it.">
            <Textarea name="tenant_note" />
          </Field>
          {emergency && (
            <div className="rounded-[var(--radius-card)] border border-danger bg-danger-bg p-4 text-danger">
              <p className="font-bold">This will go out as an emergency.</p>
              <label className="mt-2 flex items-start gap-3 text-[14px]">
                <input type="checkbox" name="ack" className="mt-0.5 size-5 shrink-0 accent-[var(--color-danger)]" />
                <span>{ackText}</span>
              </label>
            </div>
          )}
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Sending…" : safety ? "Send emergency report" : "Send request"}
          </Button>
        </section>
      )}
    </form>
  );
}
