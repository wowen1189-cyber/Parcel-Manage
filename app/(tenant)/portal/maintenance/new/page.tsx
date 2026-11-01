import { readBusinessRules } from "@/lib/business-rules";
import { requireTenant } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { FALSE_EMERGENCY_ACK } from "@/lib/triage";
import { RequestForm } from "./request-form";

export const metadata = { title: "New repair request" };

export default async function NewRequestPage() {
  const { company } = await requireTenant();
  // The fee in the acknowledgment is a company setting (staff-only table), read on the server.
  const { data } = await createAdminClient().from("company").select("settings").eq("id", company.id).single();
  const fee = readBusinessRules(data?.settings).maintenance.falseEmergencyFeeCents;
  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold leading-tight">New repair request</h1>
      <p className="text-muted">Answer a few questions so the right person comes with the right parts. It takes about a minute.</p>
      <RequestForm officePhone={company.office_phone ?? "the office"} ackText={FALSE_EMERGENCY_ACK.replace("{fee}", `$${(fee / 100).toFixed(0)}`)} />
    </div>
  );
}
