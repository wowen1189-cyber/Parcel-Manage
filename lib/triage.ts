// Guided maintenance triage (docs/03-maintenance-triage.json): category → item → symptom → questions.
// Priority always comes from the answers, never from the person picking "emergency" (docs/02 business rules).

import triageData from "@/docs/03-maintenance-triage.json";

export type Priority = "Routine" | "Urgent" | "Emergency";
export type Question = { id: string; question: string; options: string[]; showIf?: { question: string; answers: string[] } };
export type AnswerTip = { question: string; answers: string[]; tip: string; priority?: Priority };
export type Rule = { when: Record<string, string[]>; priority: Priority; tip?: string };
export type Symptom = {
  id: string;
  label: string;
  basePriority: Priority;
  questions?: Question[];
  tips?: string[];
  answerTips?: AnswerTip[];
  rules?: Rule[];
  likelyCause?: string;
  photosRequired?: boolean | null;
  flags?: Record<string, boolean> | null;
  descriptionRequired?: boolean;
};
export type Item = { id: string; label: string; symptoms: Symptom[] };
export type Category = { id: string; label: string; sub?: string; itemQuestion?: string; items: Item[] };
export type SafetyOption = { id: string; label: string; priority: Priority; screen: string; flags?: Record<string, boolean>; showFireSafety?: boolean };

const data = triageData as unknown as {
  categories: Category[];
  rooms: string[];
  safetyCheck: { options: SafetyOption[] };
  falseEmergencyAcknowledgment: string;
};

export const TRIAGE_CATEGORIES: Category[] = data.categories;
export const ROOMS: string[] = data.rooms;
export const SAFETY_OPTIONS: SafetyOption[] = data.safetyCheck.options;
export const FALSE_EMERGENCY_ACK = data.falseEmergencyAcknowledgment;

const RANK: Record<Priority, number> = { Routine: 0, Urgent: 1, Emergency: 2 };

export function findSymptom(categoryId: string, itemId: string, symptomId: string) {
  const category = TRIAGE_CATEGORIES.find((c) => c.id === categoryId);
  const item = category?.items.find((i) => i.id === itemId);
  const symptom = item?.symptoms.find((s) => s.id === symptomId);
  return category && item && symptom ? { category, item, symptom } : null;
}

/** Questions to show, given the answers so far (a question with showIf appears only after that answer). */
export function visibleQuestions(symptom: Symptom, answers: Record<string, string>): Question[] {
  return (symptom.questions ?? []).filter((q) => !q.showIf || q.showIf.answers.includes(answers[q.showIf.question] ?? ""));
}

function matches(when: Record<string, string[]>, answers: Record<string, string>) {
  return Object.entries(when).every(([q, values]) => values.includes(answers[q] ?? ""));
}

/**
 * Priority from the answers: every matching rule and answer tip with a priority is collected and the
 * highest wins, so a Routine rule can lower an Urgent base priority (e.g. heat with the home above 60°F).
 * With no match, the symptom's base priority applies.
 */
export function triagePriority(symptom: Symptom, answers: Record<string, string>): { priority: Priority; reasons: string[] } {
  const visible = new Set(visibleQuestions(symptom, answers).map((q) => q.id));
  const shown = Object.fromEntries(Object.entries(answers).filter(([q]) => visible.has(q)));
  const hits: { priority: Priority; tip?: string }[] = [
    ...(symptom.rules ?? []).filter((r) => matches(r.when, shown)),
    ...(symptom.answerTips ?? []).filter((t) => t.priority && (t.answers.includes(shown[t.question] ?? ""))).map((t) => ({ priority: t.priority!, tip: t.tip })),
  ];
  if (!hits.length) return { priority: symptom.basePriority, reasons: [] };
  const top = hits.reduce((a, b) => (RANK[b.priority] > RANK[a.priority] ? b : a));
  return { priority: top.priority, reasons: hits.filter((h) => h.priority === top.priority && h.tip).map((h) => h.tip!) };
}

/** Tips to show for the answers given (self-checks before sending a technician). */
export function tipsFor(symptom: Symptom, answers: Record<string, string>): string[] {
  return [...(symptom.tips ?? []), ...(symptom.answerTips ?? []).filter((t) => t.answers.includes(answers[t.question] ?? "")).map((t) => t.tip)];
}

/** Plain summary for the vendor and the work order record. */
export function technicianSummary(input: {
  priority: Priority;
  item: string;
  symptom: Symptom;
  answers: Record<string, string>;
  room?: string | null;
  entryOk?: boolean | null;
  pets?: boolean | null;
  note?: string | null;
}): string {
  const answered = visibleQuestions(input.symptom, input.answers)
    .filter((q) => input.answers[q.id])
    .map((q) => `${q.question.replace(/\?$/, "")}: ${input.answers[q.id]}`);
  return [
    `Priority: ${input.priority}, set from the triage answers.`,
    `${input.item}: ${input.symptom.label}.`,
    answered.length ? `${answered.join(". ")}.` : "",
    input.symptom.likelyCause ? `Likely cause: ${input.symptom.likelyCause}.` : "",
    input.room ? `Location: ${input.room}.` : "",
    input.entryOk == null ? "" : input.entryOk ? "OK to enter if no one is home." : "Tenant wants to be home for entry.",
    input.pets ? "Pets in the home." : "",
    input.note ? `Note: ${input.note}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export const PRIORITY_DB: Record<Priority, "routine" | "urgent" | "emergency"> = { Routine: "routine", Urgent: "urgent", Emergency: "emergency" };
