import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { param } from "@/components/list-filters";
import { contactName } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { NewWorkOrderForm, type PropertyOption } from "./new-work-order-form";

export const metadata = { title: "New work order" };

export default async function NewWorkOrderPage({ searchParams }: PageProps<"/maintenance/new">) {
  const { supabase, company } = await requireCompany();
  const sp = await searchParams;
  const { data } = await supabase
    .from("property")
    .select("id, name, unit(id, label, lease(status, lease_tenant(role, contact(id, first_name, last_name, business_name))))")
    .eq("company_id", company.id)
    .order("name");
  const properties: PropertyOption[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    units: [...p.unit]
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
      .map((u) => ({
        id: u.id,
        label: u.label,
        tenants: u.lease
          .filter((l) => l.status === "active" || l.status === "notice")
          .flatMap((l) => l.lease_tenant)
          .filter((t) => t.role !== "guarantor")
          .map((t) => ({ id: t.contact.id, name: contactName(t.contact) })),
      })),
  }));
  const unitParam = param(sp, "unit");
  const propertyForUnit = properties.find((p) => p.units.some((u) => u.id === unitParam))?.id;

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/maintenance" className="font-semibold text-accent hover:underline">
          ← Maintenance
        </Link>
      </p>
      <PageHeader title="New work order" subtitle="For calls, emails and things staff find. Tenants will use the same questions in their portal." />
      <div className="max-w-5xl">
        <NewWorkOrderForm properties={properties} officePhone={company.office_phone ?? "the office"} defaultPropertyId={propertyForUnit ?? param(sp, "property")} defaultUnitId={propertyForUnit ? unitParam : ""} />
      </div>
    </>
  );
}
