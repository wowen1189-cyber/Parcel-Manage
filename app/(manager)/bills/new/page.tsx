import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { billAccounts } from "@/lib/accounts";
import { recentWorkOrders } from "@/lib/bills";
import { contactName, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { NewBillForm } from "../forms";

export const metadata = { title: "New bill" };

export default async function NewBillPage() {
  const { supabase, company } = await requireCompany();
  const [{ data: vendors }, { data: properties }, { data: pos }, accounts, recent] = await Promise.all([
    supabase.from("vendor").select("id, contact(kind, first_name, last_name, business_name)").eq("company_id", company.id).eq("is_active", true),
    supabase.from("property").select("id, name").eq("company_id", company.id).order("name"),
    supabase.from("purchase_order").select("id, number, description, vendor(contact(kind, first_name, last_name, business_name)), project(name)").eq("company_id", company.id).eq("status", "approved").order("number", { ascending: false }),
    billAccounts(supabase, company.id),
    recentWorkOrders(supabase, company.id),
  ]);
  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/bills" className="font-semibold text-accent hover:underline">
          ← Bills
        </Link>
      </p>
      <PageHeader title="New bill" subtitle="Enter a vendor invoice. It posts when approved." />
      <Card className="max-w-3xl">
        <NewBillForm
          vendors={(vendors ?? []).map((v) => ({ id: v.id, name: contactName(v.contact) })).sort((a, b) => a.name.localeCompare(b.name))}
          properties={properties ?? []}
          accounts={accounts}
          today={todayIn(company.time_zone)}
          recentWorkOrders={recent}
          purchaseOrders={(pos ?? []).map((po) => ({ id: po.id, label: `PO-${po.number} · ${contactName(po.vendor.contact)} · ${po.project?.name ?? po.description}` }))}
        />
      </Card>
    </>
  );
}
