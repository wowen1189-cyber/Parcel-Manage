import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { PortalInviteList } from "@/components/portal-invite-list";
import { inviteRow, listTenantInvitees } from "@/lib/portal-invites";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Tenant portal invites" };
// Sending runs one e-mail at a time.
export const maxDuration = 300;

export default async function TenantPortalInvitesPage() {
  const { supabase, company, membership } = await requireCompany();
  const people = await listTenantInvitees(supabase, company.id);
  const rows = people.map((p) => inviteRow(p, company.time_zone));
  const canSend = ["admin", "property_manager", "leasing_agent", "maintenance_coordinator", "accountant"].includes(membership.role);
  const invited = rows.filter((r) => r.status === "invited" || r.status === "using").length;
  return (
    <>
      <PageHeader title="Tenant portal invites" subtitle="Tenants can only sign in to the portal after you invite them." action={<Link href="/tenants" className="text-[13px] font-semibold text-accent hover:underline">← Tenants</Link>} />
      <Card className="overflow-hidden">
        <CardHeader title={`${rows.length} tenants on current leases`} description={`${invited} invited so far. Check who should get an invite, then press Send. Each person gets an e-mail with the link and signs in with that same e-mail address.`} />
        {rows.length ? <PortalInviteList rows={rows} noun="tenant" canSend={canSend} /> : <EmptyState title="No current tenants">Add a lease first.</EmptyState>}
      </Card>
    </>
  );
}
