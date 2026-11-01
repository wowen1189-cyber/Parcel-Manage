import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, StatTile } from "@/components/ui";
import { contactName, date, todayIn } from "@/lib/format";
import { isAdmin, requireCompany } from "@/lib/session";
import { vendorCompliance } from "@/lib/vendors";
import { VendorForm } from "../forms";
import { PaperworkPill } from "../paperwork-pill";

export async function generateMetadata({ params }: PageProps<"/vendors/[id]">) {
  const { id } = await params;
  const { supabase, company } = await requireCompany();
  const { data } = await supabase.from("vendor").select("contact(first_name, last_name, business_name)").eq("id", id).eq("company_id", company.id).maybeSingle();
  return { title: contactName(data?.contact) || "Vendor" };
}

export default async function VendorPage({ params }: PageProps<"/vendors/[id]">) {
  const { id } = await params;
  const { supabase, company, membership } = await requireCompany();
  const { data: v } = await supabase.from("vendor").select("*, contact(*)").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!v) notFound();
  const compliance = vendorCompliance(v, todayIn(company.time_zone));
  const c = v.contact;

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/vendors" className="font-semibold text-accent hover:underline">
          ← Vendors
        </Link>
      </p>
      <PageHeader title={contactName(c)} subtitle={[v.trade, c.phone ?? c.mobile, c.email].filter(Boolean).join(" · ")} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Paperwork" value={<PaperworkPill compliance={compliance} />} />
        <StatTile label="Insurance expires" value={<span className="text-xl">{date(v.coi_expires_on, { blank: "Not on file" })}</span>} />
        <StatTile label="Last paid" value={<span className="text-xl">{date(v.last_paid_on)}</span>} />
      </div>
      <VendorForm
        canEdit={["admin", "property_manager", "maintenance_coordinator", "accountant"].includes(membership.role)}
        canOverride={isAdmin(membership)}
        vendor={{
          id: v.id,
          contact_id: c.id,
          kind: c.kind,
          business_name: c.business_name,
          first_name: c.first_name,
          last_name: c.last_name,
          email: c.email,
          phone: c.phone,
          mobile: c.mobile,
          address_line1: c.address_line1,
          address_line2: c.address_line2,
          city: c.city,
          state: c.state,
          postal_code: c.postal_code,
          contact_notes: c.notes,
          trade: v.trade,
          payment_method: v.payment_method,
          is_1099: v.is_1099,
          w9_on_file: v.w9_on_file,
          w9_received_on: v.w9_received_on,
          coi_expires_on: v.coi_expires_on,
          workers_comp_expires_on: v.workers_comp_expires_on,
          auto_insurance_expires_on: v.auto_insurance_expires_on,
          license_expires_on: v.license_expires_on,
          epa_cert_expires_on: v.epa_cert_expires_on,
          contract_expires_on: v.contract_expires_on,
          dispatch_override: v.dispatch_override,
          notes: v.notes,
        }}
      />
    </>
  );
}
