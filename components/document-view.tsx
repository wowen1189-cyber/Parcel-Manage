import type { ReactNode } from "react";
import type { Block, Condition, DocumentTemplate, Party, PartyNames } from "@/lib/documents/types";

// Draws a document template (lease, addendum, disclosure) as a printable page.
// `values` fills {{merge_fields}}; a missing value shows as a highlighted blank so nothing prints silently empty.

export type { PartyNames };

const PARTY_LABEL: Record<Party, string> = { tenants: "Tenant", guarantors: "Co-signer (guarantor)", landlord: "Landlord", agent: "Agent", owner: "Owner" };

function applies(when: Condition[] | undefined, conditions: Set<Condition>) {
  return !when || when.every((c) => conditions.has(c));
}

export function DocumentView({
  template,
  values,
  conditions,
  parties,
  choices = {},
}: {
  template: DocumentTemplate;
  values: Record<string, string>;
  conditions: Set<Condition>;
  parties: PartyNames;
  /** Pre-selected option id per choice id (office-set choices). */
  choices?: Record<string, string>;
}) {
  const fill = (text: string): ReactNode[] => {
    // Split on merge fields and **bold**.
    return text.split(/(\{\{[a-z0-9_]+\}\}|\*\*[^*]+\*\*)/g).map((part, i) => {
      const field = part.match(/^\{\{([a-z0-9_]+)\}\}$/)?.[1];
      if (field) {
        const v = values[field];
        return v ? (
          <span key={i} className="font-semibold">
            {v}
          </span>
        ) : (
          <mark key={i} className="rounded bg-warn-bg px-1 text-warn" title={template.fields[field]?.label}>
            [{template.fields[field]?.label ?? field}]
          </mark>
        );
      }
      const bold = part.match(/^\*\*([^*]+)\*\*$/)?.[1];
      return bold ? <strong key={i}>{fill(bold)}</strong> : part;
    });
  };

  const names = (p: Party) => (parties[p]?.length ? parties[p]! : [""]);

  const block = (b: Block, key: string): ReactNode => {
    switch (b.kind) {
      case "p":
        return (
          <p key={key} className="my-2 leading-relaxed">
            {fill(b.text)}
          </p>
        );
      case "list": {
        const Tag = b.ordered ? "ol" : "ul";
        return (
          <Tag key={key} className={`my-2 space-y-1 pl-6 ${b.ordered ? "list-decimal" : "list-disc"}`}>
            {b.items.map((it, i) => (
              <li key={i}>{fill(it)}</li>
            ))}
          </Tag>
        );
      }
      case "statutory":
        return (
          <div key={key} className="my-3 border-l-4 border-ink pl-3 text-[13px] uppercase leading-relaxed tracking-wide">
            {fill(b.text)}
            <span className="mt-1 block text-[11px] normal-case tracking-normal text-subtle print:hidden">Statutory text, {b.cite}</span>
          </div>
        );
      case "table":
        return (
          <table key={key} className="my-3 w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {b.head.map((h) => (
                  <th key={h} className="border border-line-strong bg-surface-muted px-2 py-1.5 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className="border border-line-strong px-2 py-1.5 align-top">
                      {fill(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "choice": {
        const picked = choices[b.id] ?? (b.field ? values[b.field] : undefined);
        return (
          <div key={key} className="my-3">
            {b.prompt && <p className="mb-1">{fill(b.prompt)}</p>}
            <ul className="space-y-1.5">
              {b.options.map((o) => (
                <li key={o.id} className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center border border-ink text-[11px] font-bold leading-none">
                    {picked === o.id ? "✓" : ""}
                  </span>
                  <span>{fill(o.text)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-subtle print:hidden">{b.setBy === "tenant" ? "Tenant chooses when signing" : "Office fills in when preparing the lease"}</p>
          </div>
        );
      }
      case "blank":
        if (values[b.id])
          return (
            <div key={key} className="my-3">
              <p className="text-[13px]">{fill(b.label)}</p>
              <p className="mt-1 border-b border-ink pb-1 font-semibold">{values[b.id]}</p>
            </div>
          );
        return (
          <div key={key} className="my-3">
            <p className="text-[13px]">{fill(b.label)}</p>
            {Array.from({ length: b.lines ?? 1 }, (_, i) => (
              <div key={i} className="mt-5 border-b border-ink" />
            ))}
          </div>
        );
      case "initials":
        return (
          <div key={key} className="my-4 flex flex-wrap gap-6">
            {(b.parties ?? ["tenants"]).flatMap((p) =>
              names(p).map((n, i) => (
                <div key={`${p}${i}`} className="w-40">
                  <div className="h-8 border-b border-ink" />
                  <p className="mt-1 text-[11px] text-subtle">
                    {b.label ?? "Initials"}
                    {n ? ` · ${n}` : ` · ${PARTY_LABEL[p]}`}
                  </p>
                </div>
              )),
            )}
          </div>
        );
      case "signatures":
        return (
          <div key={key} className="my-4 grid gap-6 sm:grid-cols-2">
            {b.parties.flatMap((p) =>
              names(p).map((n, i) => (
                <div key={`${p}${i}`} className="break-inside-avoid">
                  <div className="h-10 border-b border-ink" />
                  <p className="mt-1 text-[12px]">
                    <span className="font-semibold">{PARTY_LABEL[p]} signature</span>
                    {n && ` · ${n}`}
                  </p>
                  <div className="mt-4 grid grid-cols-[1fr_120px] gap-4">
                    <div>
                      <div className="h-6 border-b border-ink" />
                      <p className="mt-1 text-[11px] text-subtle">Printed name</p>
                    </div>
                    <div>
                      <div className="h-6 border-b border-ink" />
                      <p className="mt-1 text-[11px] text-subtle">Date</p>
                    </div>
                  </div>
                </div>
              )),
            )}
          </div>
        );
    }
  };

  const sections = template.sections.filter((s) => applies(s.when, conditions));
  return (
    <article className="document text-[14px] text-ink">
      {sections.map((s) => (
        <section key={s.id} className={`mt-8 first:mt-0 ${s.standalone ? "break-before-page" : ""}`}>
          {(s.number || s.title) && (
            <h2 className="text-center text-[20px] font-bold">
              {s.number && <span className="mr-2">{s.number}</span>}
              {s.title}
            </h2>
          )}
          {s.standalone && <p className="mt-1 text-center text-[12px] text-subtle">Separate addendum, signed on its own</p>}
          {s.clauses
            .filter((c) => applies(c.when, conditions))
            .map((c) => (
              <div key={c.id}>
                {c.title && (
                  <h3 className="mt-5 border-b border-line pb-1 text-[13px] font-semibold uppercase tracking-wide">
                    {c.number && <span className="mr-2">{c.number}</span>}
                    {c.title}
                  </h3>
                )}
                {c.blocks.map((b, i) => block(b, `${c.id}-${i}`))}
              </div>
            ))}
          {s.initials && block({ kind: "initials" }, `${s.id}-initials`)}
        </section>
      ))}
    </article>
  );
}

