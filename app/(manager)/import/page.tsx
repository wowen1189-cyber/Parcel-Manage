import { Card, CardHeader, Notice, PageHeader } from "@/components/ui";
import { isAdmin, requireCompany } from "@/lib/session";
import { ImportWizard } from "./import-wizard";

export const metadata = { title: "Import data" };

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
        </div>
      )}
    </div>
  );
}
