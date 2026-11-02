import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, EmptyState, Notice, PageHeader, Pill, buttonClass } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date, money, todayIn } from "@/lib/format";
import { readFilters } from "@/lib/report-filters";
import type { Column } from "@/lib/report-math";
import { reportById } from "@/lib/reports";
import { requireCompany } from "@/lib/session";
import { ScheduleForm } from "../schedule-form";

const show = (v: unknown, kind?: Column["kind"]) => {
  if (v === null || v === undefined || v === "") return kind === "money" ? "" : "—";
  if (kind === "money") return money(Number(v));
  if (kind === "date") return date(String(v));
  if (kind === "percent") return `${(Number(v) * 100).toFixed(1)}%`;
  return String(v);
};
const right = (k?: Column["kind"]) => k === "money" || k === "number" || k === "percent";

export async function generateMetadata({ params }: PageProps<"/reports/[id]">) {
  return { title: reportById((await params).id)?.title ?? "Report" };
}

export default async function ReportPage({ params, searchParams }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  const r = reportById(id);
  if (!r) notFound();
  const { supabase, company, membership } = await requireCompany();
  const sp = await searchParams;
  const f = readFilters(sp, todayIn(company.time_zone), r.forward);
  const [{ data: owners }, { data: properties }] = await Promise.all([
    supabase.from("entity").select("id, name").eq("company_id", company.id).order("name"),
    supabase.from("property").select("id, name").eq("company_id", company.id).order("name"),
  ]);
  // Books are per owner: default to the first owner on reports that need one.
  if (r.filters.includes("owner") && !f.owner && ["Financial", "Tax"].includes(r.group) && owners?.[0]) f.owner = owners[0].id;
  const result = r.run ? await r.run(supabase, company.id, f) : null;
  const qs = new URLSearchParams(Object.entries({ from: f.from, to: f.to, as_of: f.asOf, owner: f.owner, property: f.property }).filter(([, v]) => v)).toString();
  const sel = "min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px]";
  return (
    <>
      <PageHeader
        title={r.title}
        subtitle={`Replaces in AppFolio: ${r.replaces}`}
        action={
          <Link href="/reports" className="text-[14px] font-semibold text-accent">
            ← Reports
          </Link>
        }
      />
      {r.filters.length > 0 && (
        <form className="mb-5 flex flex-wrap items-end gap-3">
          {r.filters.includes("range") && (
            <>
              <label className="text-[13px] font-semibold">
                From
                <input type="date" name="from" defaultValue={f.from} className={`${sel} mt-1 block`} />
              </label>
              <label className="text-[13px] font-semibold">
                To
                <input type="date" name="to" defaultValue={f.to} className={`${sel} mt-1 block`} />
              </label>
            </>
          )}
          {r.filters.includes("asOf") && (
            <label className="text-[13px] font-semibold">
              As of
              <input type="date" name="as_of" defaultValue={f.asOf} className={`${sel} mt-1 block`} />
            </label>
          )}
          {r.filters.includes("owner") && (
            <label className="text-[13px] font-semibold">
              Owner
              <select name="owner" defaultValue={f.owner} className={`${sel} mt-1 block`}>
                {!["Financial", "Tax"].includes(r.group) && <option value="">All owners</option>}
                {owners?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {r.filters.includes("property") && (
            <label className="text-[13px] font-semibold">
              Property
              <select name="property" defaultValue={f.property} className={`${sel} mt-1 block`}>
                <option value="">All properties</option>
                {properties?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className={buttonClass("primary", true)}>Run</button>
          {result && result.rows.length > 0 && (
            <a href={`/reports/${r.id}/csv?${qs}`} className={buttonClass("secondary", true)}>
              Export CSV
            </a>
          )}
        </form>
      )}
      {!r.run ? (
        <EmptyState title="Coming soon">
          <Pill>Not built yet</Pill>
        </EmptyState>
      ) : (
        <>
          {result?.note && (
            <div className="mb-4">
              <Notice>{result.note}</Notice>
            </div>
          )}
          {result && result.columns.length > 0 && (
            <Card className="overflow-hidden">
              {result.rows.length ? (
                <Table minWidth={Math.max(560, result.columns.length * 120)}>
                  <Thead>
                    {result.columns.map((c) => (
                      <Th key={c.key} right={right(c.kind)}>
                        {c.label}
                      </Th>
                    ))}
                  </Thead>
                  <Tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i}>
                        {result.columns.map((c) => (
                          <Td key={c.key} right={right(c.kind)} className="text-[13px]">
                            {show(row[c.key], c.kind)}
                          </Td>
                        ))}
                      </tr>
                    ))}
                    {result.totals && (
                      <tr className="bg-surface-muted font-bold">
                        {result.columns.map((c) => (
                          <Td key={c.key} right={right(c.kind)} className="text-[13px]">
                            {result.totals![c.key] !== undefined ? show(result.totals![c.key], c.kind) : ""}
                          </Td>
                        ))}
                      </tr>
                    )}
                  </Tbody>
                </Table>
              ) : (
                <EmptyState title="Nothing for these filters" />
              )}
            </Card>
          )}
          {["admin", "accountant", "property_manager"].includes(membership.role) && (
            <Card className="mt-6">
              <CardHeader title="Schedule e-mail" />
              <div className="px-5 py-4">
                <ScheduleForm reportKey={r.id} owner={f.owner} property={f.property} />
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
