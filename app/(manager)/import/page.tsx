import { Card, CardHeader, Notice, PageHeader } from "@/components/ui";
import { isAdmin, requireCompany } from "@/lib/session";
import { date } from "@/lib/format";
import { IMPORT_KINDS } from "@/lib/import/generic";
import { ImportWizard } from "./import-wizard";
import { UndoImportButton } from "./undo-button";

export const metadata = { title: "Import data" };

/** Imports newer than this can still be undone (undo_import allows 30 days). */
const undoCutoff = () => new Date(Date.now() - 30 * 86_400_000).toISOString();

// Bring a company's data in from any property management software or a spreadsheet (docs/08 Phase 1).
export default async function ImportPage() {
  const { supabase, company, membership } = await requireCompany();
  const [{ count: properties }, { count: leases }, { count: vendors }, { count: owners }, { data: ai }, { data: asOf }] = await Promise.all([
    supabase.from("property").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("lease").select("id", { count: "exact", head: true }).eq("company_id", company.id).in("status", ["active", "notice"]),
    supabase.from("vendor").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("entity").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("ai_connection").select("status").eq("company_id", company.id).maybeSingle(),
    supabase.from("lease").select("opening_balance_as_of").eq("company_id", company.id).not("opening_balance_as_of", "is", null).limit(1),
  ]);
  const { data: batches } = await supabase.from("import_batch").select("id, kind, file_name, summary, created, created_at, undone_at").eq("company_id", company.id).order("created_at", { ascending: false }).limit(20);
  const undoFrom = undoCutoff();
  const createdSomething = (c: unknown) => Object.values((c ?? {}) as Record<string, unknown[]>).some((v) => Array.isArray(v) && v.length > 0);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: company.time_zone ?? "America/New_York" }).format(new Date());

  return (
    <div className="max-w-5xl">
      <PageHeader title="Import data" subtitle="Bring in exports from AppFolio, Buildium, Rent Manager, Yardi, any other software, or your own spreadsheet." />
      {!isAdmin(membership) ? (
        <Notice>Only admins can import data.</Notice>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader title="In this order" description={`So far: ${properties ?? 0} properties, ${leases ?? 0} current leases, ${owners ?? 0} owners and ${vendors ?? 0} vendors.`} />
            <ol className="list-decimal space-y-1 px-10 py-4 text-[14px] text-muted">
              <li><span className="font-semibold text-ink">Rent roll</span>: properties, units, leases and each tenant&apos;s rent, deposit and balance.</li>
              <li><span className="font-semibold text-ink">Owners</span>: who owns each property.</li>
              <li><span className="font-semibold text-ink">Tenant contacts</span>: phones and e-mails, if the rent roll didn&apos;t have them.</li>
              <li><span className="font-semibold text-ink">Vendors</span>.</li>
            </ol>
            <p className="border-t border-line px-5 py-3 text-[13px] text-subtle">
              Export each report as CSV (in Excel or Google Sheets: File › Save as / Download › CSV). Nothing is saved until you check the preview and press Import. Running the same file twice skips what&apos;s already here.
            </p>
          </Card>
          <ImportWizard hasAi={ai?.status === "ok"} defaultAsOf={asOf?.[0]?.opening_balance_as_of ?? today} />
          {Boolean(batches?.length) && (
            <Card>
              <CardHeader title="Recent imports" description="An import can be undone for 30 days, as long as nothing has been added to its records since (payments, charges, work orders and so on). Details it only filled in stay." />
              <ul className="divide-y divide-line">
                {batches!.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{IMPORT_KINDS.find((k) => k.kind === b.kind)?.label ?? b.kind}</span>
                      <span className="text-subtle"> · {date(b.created_at.slice(0, 10))}{b.file_name ? ` · ${b.file_name}` : ""}</span>
                      {b.summary && <span className="block text-[13px] text-muted">{b.summary}</span>}
                    </span>
                    {b.undone_at ? (
                      <span className="text-[13px] text-subtle">Undone {date(b.undone_at.slice(0, 10))}</span>
                    ) : b.created_at >= undoFrom && createdSomething(b.created) ? (
                      <UndoImportButton id={b.id} />
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
