import Link from "next/link";
import { DocumentView, listChanges } from "@/components/document-view";
import { Card, CardHeader, Notice, PageHeader, Pill, buttonClass } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { param } from "@/components/list-filters";
import { OPEN_QUESTIONS, TEMPLATES } from "@/lib/documents";
import type { Change, Condition } from "@/lib/documents/types";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Lease and disclosures" };

const SEVERITY: { key: Change["severity"]; title: string; tone: "danger" | "warn" | "neutral"; blurb: string }[] = [
  { key: "must", title: "Required by Florida law", tone: "danger", blurb: "The old wording conflicted with chapter 83. These had to change." },
  { key: "disclosure", title: "Required disclosures", tone: "danger", blurb: "Disclosures the statute (or federal law) requires that were missing or incomplete." },
  { key: "attorney", title: "For your attorney", tone: "warn", blurb: "Risky or likely unenforceable wording, narrowed or kept as a business decision. Your attorney decides." },
  { key: "cleanup", title: "Cleanup", tone: "neutral", blurb: "Typos, leftover placeholders, and fixed numbers turned into settings." },
];

// Every condition on, so the whole template (all optional sections) shows.
const ALL: Condition[] = ["single_family", "multi_unit", "has_pets", "pre_1978", "deposit_alternative_offered", "repair_deductible", "tenant_lawn_care", "has_guarantor", "email_notices", "long_term", "resident_pest_control", "irrigation"];

export default async function LeaseTemplatePage({ searchParams }: PageProps<"/tenants/lease-template">) {
  await requireCompany();
  const params = await searchParams;
  const doc = TEMPLATES.find((t) => t.id === param(params, "doc")) ?? TEMPLATES[0];
  const changes = listChanges(doc);
  const showChanges = param(params, "changes") !== "0";

  return (
    <>
      <p className="mb-2 text-[13px] print:hidden">
        <Link href="/tenants" className="font-semibold text-accent hover:underline">
          ← Tenants & leases
        </Link>
      </p>
      <PageHeader title="Lease and disclosures" subtitle="SIM REI's lease, rebuilt with the Florida law fixes. Attorney approval needed before first use." action={<PrintButton />} />

      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        {TEMPLATES.map((t) => (
          <Link key={t.id} href={`/tenants/lease-template?doc=${t.id}`} className={buttonClass(t.id === doc.id ? "primary" : "secondary", true)}>
            {t.title}
          </Link>
        ))}
        <Link href={`/tenants/lease-template?doc=${doc.id}&changes=${showChanges ? "0" : "1"}`} className={buttonClass("ghost", true)}>
          {showChanges ? "Hide changes" : "Show changes"}
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="px-6 py-8 sm:px-10 print:border-0 print:p-0">
          <DocumentView
            template={doc}
            values={Object.fromEntries(Object.entries(doc.fields).filter(([, fd]) => fd.source === "setting" || fd.fixedByLaw).map(([k, fd]) => [k, fd.example]))} conditions={new Set(ALL)} parties={{}} showChanges={showChanges} />
        </Card>

        <aside className="space-y-6 print:hidden">
          <Card>
            <CardHeader title={`${changes.length} changes`} description="Everything that differs from your AppFolio version. Outlined in the document." />
            <div className="divide-y divide-line">
              {SEVERITY.map((s) => {
                const items = changes.filter((c) => c.severity === s.key);
                if (!items.length) return null;
                return (
                  <details key={s.key} open={s.key === "must"} className="px-5 py-3">
                    <summary className="cursor-pointer">
                      <span className="text-sm font-semibold">{s.title}</span> <Pill tone={s.tone}>{items.length}</Pill>
                      <p className="mt-0.5 text-[13px] text-subtle">{s.blurb}</p>
                    </summary>
                    <ol className="mt-3 space-y-2.5 text-[13px]">
                      {items.map((c, i) => (
                        <li key={i}>
                          <p className="font-semibold">
                            §{c.where} <span className="font-normal text-subtle">· {c.cite}</span>
                          </p>
                          <p className="text-muted">{c.summary}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                );
              })}
            </div>
          </Card>
          {doc.id === TEMPLATES[0].id && (
            <Card>
              <CardHeader title="Questions for you" description="Blanks in the lease until these are answered." />
              <ol className="list-decimal space-y-2 py-4 pl-10 pr-5 text-[13px] text-muted">
                {OPEN_QUESTIONS.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </Card>
          )}
          <Notice tone="warn">This is not legal advice. The changes follow the saved Florida statute; have your attorney approve the lease before using it.</Notice>
        </aside>
      </div>
    </>
  );
}
