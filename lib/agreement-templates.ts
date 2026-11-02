// A company's own management agreement (agreement_template): a list of parts, each a heading and text,
// optionally shown only when the owner grants a power. Text uses the built-in agreement's {{merge_fields}}
// and **bold**; a blank line starts a new paragraph and lines starting "- " are a list. Parts become a
// DocumentTemplate, so the same view, e-signature and signed PDF work for uploaded agreements.

import { z } from "zod";
import { MANAGEMENT_AGREEMENT } from "@/lib/documents/management-agreement";
import type { Block, Condition, DocumentTemplate } from "@/lib/documents/types";

export const PART_WHEN = {
  pma_leasing: "Only when the owner lets you lease",
  pma_evictions: "Only when the owner lets you handle notices and evictions",
  pma_contractors: "Only when the owner lets you hire vendors",
  pma_disbursements: "Only when you pay the owner's mortgage, taxes and insurance",
  pma_auto_renew: "Only when the agreement renews on its own",
} as const satisfies Partial<Record<Condition, string>>;
export type PartWhen = keyof typeof PART_WHEN;

export const partSchema = z.object({
  id: z.string().min(1).max(40),
  heading: z.string().trim().max(200),
  body: z.string().max(20_000),
  when: z.enum(Object.keys(PART_WHEN) as [PartWhen, ...PartWhen[]]).nullable(),
});
export type Part = z.infer<typeof partSchema>;
export const partsSchema = z.array(partSchema).max(200);

export const FIELDS = MANAGEMENT_AGREEMENT.fields;

/** The template new agreements start with (company.settings.agreementTemplateId); null is the built-in one. */
export function defaultTemplateId(settings: unknown): string | null {
  const v = settings && typeof settings === "object" ? (settings as { agreementTemplateId?: unknown }).agreementTemplateId : null;
  return typeof v === "string" && v ? v : null;
}

export function readParts(stored: unknown): Part[] {
  const parsed = partsSchema.safeParse(stored);
  return parsed.success ? parsed.data : [];
}

/** Merge fields written in the parts that the agreement doesn't know (usually a typo). */
export function unknownFields(parts: Part[]): string[] {
  const text = parts.map((p) => `${p.heading}\n${p.body}`).join("\n");
  return [...new Set([...text.matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)].map((m) => m[1]))].filter((k) => !(k in FIELDS));
}

function bodyToBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  for (const para of body.split(/\n\s*\n/)) {
    const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
    let text: string[] = [];
    let items: string[] = [];
    const flush = () => {
      if (text.length) blocks.push({ kind: "p", text: text.join(" ") });
      if (items.length) blocks.push({ kind: "list", items });
      text = [];
      items = [];
    };
    for (const line of lines) {
      if (/^[-•●▪◦*]\s+/.test(line)) {
        if (text.length) {
          blocks.push({ kind: "p", text: text.join(" ") });
          text = [];
        }
        items.push(line.replace(/^[-•●▪◦*]\s+/, ""));
      } else if (items.length) {
        // A wrapped list line continues the item above it.
        items[items.length - 1] += ` ${line}`;
      } else text.push(line);
    }
    flush();
  }
  return blocks;
}

/** The company's agreement as a document template, ending with the owner's and the broker's signatures. */
export function partsToTemplate(name: string, parts: Part[]): DocumentTemplate {
  return {
    id: "custom-management-agreement",
    title: name,
    version: "custom",
    appliesTo: "Owner and managing broker",
    fields: FIELDS,
    sections: [
      ...parts.map((p) => ({ id: p.id, title: p.heading, when: p.when ? [p.when] : undefined, clauses: [{ id: `${p.id}-text`, blocks: bodyToBlocks(p.body) }] })),
      { id: "signatures", title: "Signatures", clauses: [{ id: "signatures", blocks: [{ kind: "signatures", parties: ["owner", "agent"] }] }] },
    ],
  };
}

const blockText = (b: Block): string => {
  switch (b.kind) {
    case "p":
      return b.text;
    case "list":
      return b.items.map((i) => `- ${i}`).join("\n");
    case "statutory":
      return `${b.text} (${b.cite})`;
    case "table":
      return b.rows.map((r) => `- ${r.join(": ")}`).join("\n");
    case "choice":
      return [b.prompt, ...b.options.map((o) => `- ${o.text}`)].filter(Boolean).join("\n");
    case "blank":
      return `${b.label}: __________`;
    default:
      return "";
  }
};

/**
 * Parcel Manage's Florida agreement as editable parts: one per section, with optional clauses split into
 * their own parts so they still appear only when they apply. The signature section is added automatically.
 */
export function builtinParts(): Part[] {
  const parts: Part[] = [];
  let n = 0;
  const id = () => `p${++n}`;
  for (const s of MANAGEMENT_AGREEMENT.sections) {
    if (s.id === "signatures") continue;
    let current: Part = { id: id(), heading: [s.number, s.title].filter(Boolean).join(" "), body: "", when: null };
    parts.push(current);
    for (const c of s.clauses) {
      const title = c.title ? `**${[c.number, c.title].filter(Boolean).join(" ")}.** ` : "";
      const text = c.blocks.map(blockText).filter(Boolean);
      if (text.length) text[0] = title + text[0];
      const when = (c.when?.find((w) => w in PART_WHEN) as PartWhen | undefined) ?? null;
      if (when || current.when) {
        current = { id: id(), heading: "", body: "", when };
        parts.push(current);
      }
      current.body = [current.body, ...text].filter(Boolean).join("\n\n");
    }
  }
  return parts.filter((p) => p.heading || p.body);
}

const HEADING = /^(?:(?:section|article)\s+)?\d+(?:\.\d+)*\.?\s+\S.{0,80}$/i;
const isHeading = (line: string) => line.length <= 90 && !/[.;,]$/.test(line) && (HEADING.test(line) || (/[A-Z]/.test(line) && line === line.toUpperCase() && line.length >= 4 && !/^[-•●▪◦*]/.test(line)));

/**
 * Text from an uploaded agreement split into parts at its headings ("1.2 RECITALS", "ARTICLE 3 FEES",
 * all-caps lines). Wrapped lines are joined; a short line ending a sentence ends its paragraph.
 */
export function textToParts(text: string): Part[] {
  const lines = text.replace(/\r/g, "").replace(/ /g, " ").split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const longest = Math.max(40, ...lines.map((l) => l.length));
  const parts: Part[] = [];
  let current: Part | null = null;
  let para = "";
  const endPara = () => {
    if (!para) return;
    current ??= { id: `p${parts.length + 1}`, heading: "", body: "", when: null };
    if (!parts.includes(current)) parts.push(current);
    current.body = current.body ? `${current.body}\n\n${para}` : para;
    para = "";
  };
  for (const line of lines) {
    if (!line) {
      endPara();
      continue;
    }
    if (isHeading(line)) {
      endPara();
      // A heading that wrapped onto a second, unnumbered line.
      if (current && current.heading && !current.body && !/^\d/.test(line) && /[&,-]$|\band$/i.test(current.heading)) {
        current.heading += ` ${line}`;
        continue;
      }
      current = { id: `p${parts.length + 1}`, heading: line, body: "", when: null };
      parts.push(current);
      continue;
    }
    const bullet = /^[•●▪◦*]\s*/.test(line);
    if (bullet) {
      endPara();
      para = `- ${line.replace(/^[•●▪◦*]\s*/, "")}`;
    } else para = para ? `${para} ${line}` : line;
    if (/[.:;]$/.test(line) && line.length < longest * 0.75) endPara();
  }
  endPara();
  // Keep list items together: a bullet paragraph followed by another bullet joins with a single line break.
  for (const p of parts) p.body = p.body.replace(/\n\n(?=- )/g, (m, offset: number, s: string) => (s.slice(0, offset).split("\n\n").pop()?.startsWith("- ") ? "\n" : m));
  return parts.slice(0, 200);
}
