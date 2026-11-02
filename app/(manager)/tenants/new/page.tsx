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
  // Coming from an approved application: fill in what the applicants already gave us.
  const applicationId = param(sp, "application");
  const { data: app } = applicationId
    ? await supabase.from("application").select("rent_cents, deposit_cents, desired_move_in, application_member(role, first_name, last_name, email, phone)").eq("id", applicationId).eq("company_id", company.id).eq("status", "approved").maybeSingle()
    : { data: null };
  const prefill: Record<string, string> = {};
  // From the lease length planner: the chosen start, length and rent.
  if (/^\d{4}-\d{2}-\d{2}$/.test(param(sp, "start"))) prefill.start_date = param(sp, "start");
  if (/^\d{1,2}$/.test(param(sp, "months"))) prefill.months = param(sp, "months");
  if (/^\d+(\.\d{1,2})?$/.test(param(sp, "rent"))) prefill.rent = param(sp, "rent");
  if (app) {
    prefill.rent = (app.rent_cents / 100).toFixed(2);
    if (app.deposit_cents !== null) prefill.deposit = (app.deposit_cents / 100).toFixed(2);
    if (app.desired_move_in) prefill.start_date = app.desired_move_in;
    app.application_member
      .sort((a, b) => (a.role === "applicant" ? -1 : b.role === "applicant" ? 1 : 0))
      .slice(0, 6)
      .forEach((m, i) => {
        prefill[`p${i}_role`] = m.role === "guarantor" ? "guarantor" : "tenant";
        prefill[`p${i}_first_name`] = m.first_name;
        prefill[`p${i}_last_name`] = m.last_name;
        prefill[`p${i}_email`] = m.email ?? "";
        prefill[`p${i}_mobile`] = m.phone ?? "";
      });
  }

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
          prefill={prefill}
        />
      </div>
    </>
  );
}
