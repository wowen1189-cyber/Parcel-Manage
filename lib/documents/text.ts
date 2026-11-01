// A filled document as plain text: what gets frozen when it's sent for signature (so what's signed can't
// change later), hashed for the audit trail, and printed into the signed PDF. Mirrors components/document-view.tsx.

import type { Block, Condition, DocumentTemplate } from "./types";

export type DocText = { title: string; sections: { heading: string; paragraphs: string[] }[] };

const applies = (when: Condition[] | undefined, conditions: Set<Condition>) => !when || when.every((c) => conditions.has(c));

export function documentToText(template: DocumentTemplate, values: Record<string, string>, conditions: Set<Condition>, choices: Record<string, string> = {}): DocText {
  const fill = (s: string) => s.replace(/\{\{([a-z0-9_]+)\}\}/g, (_, k: string) => values[k] || "__________").replace(/\*\*([^*]+)\*\*/g, "$1");
  const block = (b: Block): string[] => {
    switch (b.kind) {
      case "p":
        return [fill(b.text)];
      case "list":
        return b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : "•"} ${fill(it)}`);
      case "statutory":
        return [fill(b.text).toUpperCase(), `(${b.cite})`];
      case "table":
        return [b.head.join(" | "), ...b.rows.map((r) => r.map(fill).join(" | "))];
      case "choice": {
        const picked = choices[b.id] ?? (b.field ? values[b.field] : undefined);
        return [...(b.prompt ? [fill(b.prompt)] : []), ...b.options.map((o) => `[${picked === o.id ? "X" : " "}] ${fill(o.text)}`)];
      }
      case "blank":
        return [`${fill(b.label)}: ${values[b.id] || "__________"}`];
      case "initials":
      case "signatures":
        return [];
    }
  };
  return {
    title: template.title,
    sections: template.sections
      .filter((s) => applies(s.when, conditions))
      .map((s) => ({
        heading: [s.number, s.title].filter(Boolean).join(" "),
        paragraphs: s.clauses
          .filter((c) => applies(c.when, conditions))
          .flatMap((c) => [...(c.title ? [[c.number, c.title].filter(Boolean).join(" ").toUpperCase()] : []), ...c.blocks.flatMap(block)]),
      })),
  };
}

/** Merge fields used by the parts of the document that apply (so optional sections don't count as blanks). */
export function usedFields(template: DocumentTemplate, conditions: Set<Condition>): string[] {
  const json = JSON.stringify(template.sections.filter((s) => applies(s.when, conditions)).map((s) => s.clauses.filter((c) => applies(c.when, conditions)).map((c) => c.blocks)));
  return [...new Set([...json.matchAll(/\{\{([a-z0-9_]+)\}\}/g)].map((m) => m[1]))];
}
