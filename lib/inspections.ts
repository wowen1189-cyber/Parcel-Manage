// Move-in and move-out inspections (inspection table): each room's condition, notes and photos. Comparing
// the two finds what got worse, which is where deposit deductions for damage beyond normal wear and tear
// come from (Fla. Stat. 83.49(3); the 83.491 wording "damage ... beyond normal wear and tear"). Suggestions
// only: a person decides every deduction and its amount.

import { z } from "zod";

export const CONDITIONS = { good: "Good", fair: "Fair (normal wear)", damaged: "Damaged", missing: "Missing or broken" } as const;
export type Condition = keyof typeof CONDITIONS;
const RANK: Record<Condition, number> = { good: 0, fair: 1, damaged: 2, missing: 3 };

export const INSPECTION_KIND = { move_in: "Move-in inspection", move_out: "Move-out inspection" } as const;
export type InspectionKind = keyof typeof INSPECTION_KIND;

export const roomSchema = z.object({
  id: z.string().min(1).max(40),
  room: z.string().trim().min(1).max(80),
  condition: z.enum(["good", "fair", "damaged", "missing"]),
  notes: z.string().max(2000),
  photos: z.array(z.string().max(300)).max(12),
});
export type Room = z.infer<typeof roomSchema>;
export const roomsSchema = z.array(roomSchema).max(40);

export function readRooms(stored: unknown): Room[] {
  const parsed = roomsSchema.safeParse(stored);
  return parsed.success ? parsed.data : [];
}

/** Starting rooms for a unit: the usual rooms of a home (from the triage room list), all marked good. */
export function defaultRooms(roomNames: string[], beds: number | null, baths: number | null): Room[] {
  const names: string[] = [];
  for (const r of roomNames) {
    if (/^bedroom/i.test(r)) {
      const n = Math.max(1, Math.min(beds ?? 1, 6));
      for (let i = 1; i <= n; i++) names.push(n === 1 ? "Bedroom" : `Bedroom ${i}`);
    } else if (/^bathroom/i.test(r)) {
      const n = Math.max(1, Math.min(Math.ceil(baths ?? 1), 5));
      for (let i = 1; i <= n; i++) names.push(n === 1 ? "Bathroom" : `Bathroom ${i}`);
    } else names.push(r);
  }
  return [...new Set(names)].map((room, i) => ({ id: `r${i + 1}`, room, condition: "good", notes: "", photos: [] }));
}

export type Change = { room: string; before: Condition | null; after: Condition; beforeNotes: string; afterNotes: string };

/** Rooms that are worse at move-out than at move-in (or damaged with no move-in record). */
export function worsenedRooms(moveIn: Room[], moveOut: Room[]): Change[] {
  const before = new Map(moveIn.map((r) => [r.room.toLowerCase(), r]));
  return moveOut
    .map((r) => {
      const b = before.get(r.room.toLowerCase()) ?? null;
      return { room: r.room, before: b?.condition ?? null, after: r.condition, beforeNotes: b?.notes ?? "", afterNotes: r.notes };
    })
    .filter((c) => (c.before ? RANK[c.after] > RANK[c.before] && RANK[c.after] >= RANK.damaged : RANK[c.after] >= RANK.damaged));
}

export type Suggestion = { description: string; amount_cents: number; reason: string };
export const suggestionsSchema = z.array(z.object({ description: z.string().min(1).max(200), amount_cents: z.number().int().min(0).max(5_000_000), reason: z.string().max(400) })).max(20);

/** Without AI: one line per room that got worse, with no amount (the office prices it). */
export function fallbackSuggestions(changes: Change[]): Suggestion[] {
  return changes.map((c) => ({
    description: `${c.room}: ${c.afterNotes.trim() || CONDITIONS[c.after].toLowerCase()}`.slice(0, 200),
    amount_cents: 0,
    reason: c.before ? `${CONDITIONS[c.before]} at move-in, ${CONDITIONS[c.after].toLowerCase()} at move-out.` : `${CONDITIONS[c.after]} at move-out; no move-in record for this room.`,
  }));
}

/** The AI's answer: a JSON array of suggestions (it may wrap it in a code block). Anything else is rejected. */
export function parseSuggestions(text: string): Suggestion[] | null {
  const json = text.match(/\[[\s\S]*\]/)?.[0];
  if (!json) return null;
  try {
    const parsed = suggestionsSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** What the AI is told about the tenancy (no names or contact details). */
export function deductionPrompt(input: { months: number; changes: Change[]; moveOutNotes: string }): string {
  const lines = input.changes.map(
    (c) => `- ${c.room}: move-in ${c.before ? `${CONDITIONS[c.before]}${c.beforeNotes ? ` (${c.beforeNotes})` : ""}` : "not recorded"}; move-out ${CONDITIONS[c.after]}${c.afterNotes ? ` (${c.afterNotes})` : ""}`,
  );
  return `Tenancy length: ${input.months} months.\nRooms that changed:\n${lines.join("\n")}${input.moveOutNotes ? `\nInspector's overall notes: ${input.moveOutNotes}` : ""}`;
}

export const DEDUCTION_SYSTEM =
  "You help a Florida property manager list possible security deposit deductions after a move-out inspection. Only damage beyond normal wear and tear, missing items, or cleaning beyond normal use can be deducted (Fla. Stat. 83.49(3)); normal wear for the tenancy length (faded paint, light carpet wear, small nail holes, minor scuffs) cannot. Use only the facts given. For each item that is more than normal wear, give a short description a tenant would understand, a fair repair or replacement estimate in US cents (prorate items by age where the facts allow, otherwise estimate typical Central Florida labor and materials), and a one-sentence reason. Leave out anything that is normal wear. Answer with only a JSON array: [{\"description\": string, \"amount_cents\": integer, \"reason\": string}]. An empty array is fine.";
