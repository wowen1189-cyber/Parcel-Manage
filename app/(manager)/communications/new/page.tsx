import Link from "next/link";
import { buttonClass, Card, Notice, PageHeader } from "@/components/ui";
import { param } from "@/components/list-filters";
import { contactName } from "@/lib/format";
import { letterContext } from "@/lib/letter-context";
import { letterById, LETTERS } from "@/lib/letters";
import { requireCompany } from "@/lib/session";
import { LetterForm } from "./letter-form";

export const metadata = { title: "New letter" };

export default async function NewLetterPage({ searchParams }: PageProps<"/communications/new">) {
  const { supabase, company, membership, user } = await requireCompany();
  const sp = await searchParams;
  const template = letterById(param(sp, "template")) ?? LETTERS[0];
  const leaseId = param(sp, "lease");
  const { data: leases } = await supabase
    .from("lease")
    .select("id, status, unit(label, property(name)), lease_tenant(is_primary, role, contact(kind, first_name, last_name, business_name))")
    .eq("company_id", company.id)
    .in("status", ["active", "notice", "ended"])
    .order("start_date", { ascending: false });
  const options = (leases ?? [])
    .map((l) => ({ id: l.id, label: `${contactName([...l.lease_tenant].filter((t) => t.role === "tenant").sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0]?.contact)} · ${l.unit.property.name}${l.unit.label !== "Home" ? ` ${l.unit.label}` : ""}${l.status === "ended" ? " (past)" : ""}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const { data: profile } = await supabase.from("profile").select("full_name").eq("id", user.id).single();
  const found = leaseId ? await letterContext(supabase, company, leaseId, { name: profile?.full_name ?? company.name, title: membership.title ?? "" }) : null;

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/communications" className="font-semibold text-accent hover:underline">
          ← Communications
        </Link>
      </p>
      <PageHeader title={template.title} subtitle={[template.cite, template.description].filter(Boolean).join(" · ")} />
      <Card className="mb-6 p-5">
        <form action="/communications/new" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="template" value={template.id} />
          <label className="min-w-72 flex-1 text-[13px] font-semibold text-ink-2">
            Tenant
            <select name="lease" defaultValue={leaseId} className="mt-1.5 block min-h-11 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm">
              <option value="">Choose a tenant…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button className={buttonClass("secondary", true)}>Use this tenant</button>
        </form>
      </Card>
      {!found ? (
        <Notice>Choose the tenant to fill in the letter.</Notice>
      ) : (
        <LetterForm
          templateId={template.id}
          leaseId={leaseId}
          ctx={found.ctx}
          defaultTitle={membership.title ?? ""}
          emailNotices={found.emailNotices}
          hasEmail={found.tenants.some((t) => t.email)}
          prefill={Object.fromEntries(template.inputs.map((i) => [i.id, param(sp, `in_${i.id}`)]).filter(([, v]) => v))}
        />
      )}
    </>
  );
}
