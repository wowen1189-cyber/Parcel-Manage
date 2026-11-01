import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { param } from "@/components/list-filters";
import { readBusinessRules } from "@/lib/business-rules";
import { todayIn } from "@/lib/format";
import { addMonths, monthOf, type LeaseEnd } from "@/lib/lease-expirations";
import { requireCompany } from "@/lib/session";
import { NewLeaseForm, type UnitOption } from "./new-lease-form";

export const metadata = { title: "New tenant and lease" };

export default async function NewLeasePage({ searchParams }: PageProps<"/tenants/new">) {
  const { supabase, company } = await requireCompany();
  const sp = await searchParams;
  const today = todayIn(company.time_zone);
  const [{ data: units }, { data: leases }] = await Promise.all([
    supabase.from("unit").select("id, label, kind, status, market_rent_cents, property!inner(id, name), lease(status)").eq("company_id", company.id),
    supabase.from("lease").select("id, status, end_date, move_out_on, unit!inner(property_id)").eq("company_id", company.id).in("status", ["active", "notice"]),
  ]);

  const all = units ?? [];
  const unitsByProperty: Record<string, number> = {};
  for (const u of all) unitsByProperty[u.property.id] = (unitsByProperty[u.property.id] ?? 0) + 1;
  // Units that can take a new lease: no active lease, or the current tenant is on notice.
  const options: UnitOption[] = all
    .map((u) => ({
      id: u.id,
      label: u.label,
      propertyId: u.property.id,
      propertyName: u.property.name,
      kind: u.kind,
      marketRentCents: u.market_rent_cents,
      status: u.status,
      hasActiveLease: u.lease.some((l) => l.status === "active"),
    }))
    .filter((u) => !u.hasActiveLease || u.status === "notice")
    .sort((a, b) => a.propertyName.localeCompare(b.propertyName) || a.label.localeCompare(b.label, undefined, { numeric: true }));
  const leaseEnds: LeaseEnd[] = (leases ?? []).map((l) => ({ leaseId: l.id, propertyId: l.unit.property_id, endDate: l.end_date, status: l.status, moveOutOn: l.move_out_on }));
  const requested = param(sp, "unit");

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/tenants" className="font-semibold text-accent hover:underline">
          ← Tenants & leases
        </Link>
      </p>
      <PageHeader title="New tenant and lease" subtitle="Pick the unit and start date; Parcel Manage suggests the length that keeps move-outs spread out." />
      <div className="max-w-5xl">
        <NewLeaseForm
          units={options}
          leaseEnds={leaseEnds}
          unitsByProperty={unitsByProperty}
          portfolioUnits={all.length}
          rules={readBusinessRules(company.settings)}
          defaultUnitId={options.some((u) => u.id === requested) ? requested : ""}
          defaultStart={`${addMonths(monthOf(today), 1)}-01`}
        />
      </div>
    </>
  );
}
