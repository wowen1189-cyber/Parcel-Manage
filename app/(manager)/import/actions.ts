"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aiComplete } from "@/lib/ai/provider";
import { cleanMapping, columnShapes, IMPORT_KINDS, kindInfo, normalize, type ImportKind, type Mapping } from "@/lib/import/generic";
import { saveImport, type ImportResult } from "@/lib/import/save";
import { isAdmin, requireCompany } from "@/lib/session";

const ADMIN_ONLY = "Only admins can import data.";
const kinds = IMPORT_KINDS.map((k) => k.kind) as [ImportKind, ...ImportKind[]];

const sheetSchema = z.object({
  kind: z.enum(kinds),
  headers: z.array(z.string().max(200)).max(200),
  rows: z.array(z.array(z.string().max(2000)).max(200)).max(5000, "That file has more than 5,000 rows. Split it into smaller files."),
  headerRow: z.number().int().min(0),
});

/**
 * Asks the company's AI to match columns the heading rules missed. Only the headings and what kind of
 * values each column holds (dates, money, text) are sent, never the tenants' names or numbers.
 */
export async function matchColumnsWithAi(input: z.input<typeof sheetSchema>): Promise<{ mapping?: Mapping; error?: string }> {
  const { company, membership } = await requireCompany();
  if (!isAdmin(membership)) return { error: ADMIN_ONLY };
  const p = sheetSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const sheet = p.data;
  const info = kindInfo(sheet.kind);
  const r = await aiComplete({
    companyId: company.id,
    feature: "import_columns",
    system:
      "You match spreadsheet columns from property management software exports to the fields of an import. Reply with JSON only: an object whose keys are field keys and whose values are the 0-based column number, or null when no column fits. Use each column at most once. Prefer null over a doubtful match.",
    prompt: [
      `This file is a ${info.label.toLowerCase()} export.`,
      "Fields (key: meaning):",
      ...info.fields.map((f) => `${f.key}: ${f.label}${f.hint ? ` (${f.hint})` : ""}`),
      "Columns (number. heading: what the values look like):",
      ...columnShapes(sheet).map((c, i) => `${i}. ${c}`),
    ].join("\n"),
    maxTokens: 700,
  });
  if (!r.ok) return { error: r.reason };
  try {
    const json = JSON.parse(r.text.replace(/^```(json)?|```$/g, "").trim()) as Record<string, unknown>;
    return { mapping: cleanMapping(sheet.kind, sheet.headers, json) };
  } catch {
    return { error: "The AI's answer couldn't be read. Match the columns by hand." };
  }
}

/** Checks (commit=false) or imports (commit=true) the file. The rows are re-read here, never trusted as sent. */
export async function runImport(input: z.input<typeof sheetSchema> & { mapping: Record<string, unknown>; asOf: string; commit: boolean; fileName?: string }): Promise<{ result?: ImportResult; error?: string }> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!isAdmin(membership)) return { error: ADMIN_ONLY };
  const p = sheetSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const asOf = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(input.asOf);
  if (!asOf.success) return { error: "Choose the date the export was run (the cutover date)." };
  const mapping = cleanMapping(p.data.kind, p.data.headers, input.mapping ?? {});
  const missing = kindInfo(p.data.kind).fields.filter((f) => f.required && mapping[f.key] == null);
  if (missing.length) return { error: `Pick a column for ${missing.map((f) => f.label).join(", ")}.` };
  const data = normalize(p.data.kind, p.data, mapping);
  if (!data.records.length) return { error: "No rows to import. Check the column matches." };
  try {
    const result = await saveImport(supabase, company.id, data, { commit: Boolean(input.commit), asOf: asOf.data });
    if (input.commit) {
      // Kept for 30 days so the import can be undone (migration 0041).
      await supabase.from("import_batch").insert({
        company_id: company.id,
        kind: p.data.kind,
        file_name: String(input.fileName ?? "").slice(0, 200) || null,
        summary: result.done.join(" ").slice(0, 1000),
        created: result.created ?? {},
        created_by: user.id,
      });
      for (const path of ["/properties", "/tenants", "/vendors", "/owners", "/dashboard", "/switch-over"]) revalidatePath(path);
    }
    return { result };
  } catch (e) {
    return { error: `The import stopped: ${e instanceof Error ? e.message : "unknown error"}. Nothing from this file was kept; fix the problem and run it again.` };
  }
}

/** Undo an import from the last 30 days: removes what it created, unless something already uses it. */
export async function undoImport(form: FormData): Promise<{ error?: string; message?: string }> {
  const { supabase, membership } = await requireCompany();
  if (!isAdmin(membership)) return { error: ADMIN_ONLY };
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "Import not found." };
  const { error } = await supabase.rpc("undo_import", { p_batch: id.data });
  if (error) {
    const inUse = error.message.match(/in use now \((\d+) in (\w+)\)/);
    const what: Record<string, [string, string]> = {
      charge: ["charge", "charges"],
      payment: ["payment", "payments"],
      work_order: ["work order", "work orders"],
      recurring_work_order: ["recurring maintenance schedule", "recurring maintenance schedules"],
      bill: ["bill", "bills"],
      document: ["document", "documents"],
      unit: ["unit added by hand", "units added by hand"],
      lease: ["lease added by hand", "leases added by hand"],
      journal_line: ["accounting entry", "accounting entries"],
      move_out: ["move-out", "move-outs"],
      signature_request: ["signature request", "signature requests"],
      automation_task: ["To do item", "To do items"],
    };
    if (inUse) {
      const count = Number(inUse[1]);
      const [one, many] = what[inUse[2]] ?? [inUse[2].replace(/_/g, " "), `${inUse[2].replace(/_/g, " ")} records`];
      return { error: `Can't undo: ${count} ${count === 1 ? one : many} already ${count === 1 ? "uses" : "use"} records from this import. Remove ${count === 1 ? "it" : "them"} first if you still want to undo. Nothing was changed.` };
    }
    return { error: error.message };
  }
  for (const path of ["/import", "/properties", "/tenants", "/vendors", "/owners", "/dashboard", "/switch-over"]) revalidatePath(path);
  return { message: "Undone. Everything this import added is removed." };
}
