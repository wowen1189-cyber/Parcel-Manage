import { Card, PageHeader } from "@/components/ui";
import { GUEST_SOURCES, GUEST_STATUS, unitName } from "@/lib/leasing";
import { requireCompany } from "@/lib/session";
import { GuestCardForm } from "../../forms";

export const metadata = { title: "New guest card" };

export default async function NewGuestPage() {
  const { supabase, company } = await requireCompany();
  const { data: units } = await supabase.from("unit").select("id, label, property(name)").eq("company_id", company.id).in("status", ["vacant", "notice", "listed"]);
  return (
    <>
      <PageHeader title="New guest card" subtitle="Someone asked about a rental." />
      <Card className="max-w-[760px] p-5">
        <GuestCardForm units={(units ?? []).map((u) => ({ id: u.id, name: unitName(u) }))} sources={GUEST_SOURCES} statuses={GUEST_STATUS} />
      </Card>
    </>
  );
}
