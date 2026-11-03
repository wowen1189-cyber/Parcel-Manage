import Link from "next/link";
import { param } from "@/components/list-filters";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { PortalInviteList } from "@/components/portal-invite-list";
import { inviteRow, listOwnerInvitees } from "@/lib/portal-invites";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Owner portal invites" };
// Sending runs one e-mail at a time.
export const maxDuration = 300;

export default async function OwnerPortalInvitesPage({ searchParams }: PageProps<"/owners/portal-invites">) {
  const { supabase, company, membership } = await requireCompany();
  const owner = param(await searchParams, "owner");
  const people = await listOwnerInvitees(supabase, company.id, /^[0-9a-f-]{36}$/.test(owner) ? owner : undefined);
  const rows = people.map((p) => inviteRow(p, company.time_zone));
  const canSend = ["admin", "property_manager", "accountant"].includes(membership.role);
  const invited = rows.filter((r) => r.status === "invited").length;
  return (
    <>
      <PageHeader
        title="Owner portal invites"
        subtitle="Owners and partners can only sign in to the owner portal after you invite them."
        action={<Link href={owner ? `/owners/${owner}` : "/owners"} className="text-[13px] font-semibold text-accent hover:underline">{owner ? "← Owner" : "← Owners"}</Link>}
      />
      <Card className="overflow-hidden">
        <CardHeader
          title={owner && rows[0] ? rows[0].name : `${rows.length} ${rows.length === 1 ? "owner or partner" : "owners and partners"}`}
          description={`${invited} invited so far. An owner sees their properties, statements, distributions and the documents you share with them. A partner sees the owners they're a partner in.`}
        />
        {owner && (
          <p className="border-b border-line px-5 py-2 text-[13px]">
            <Link href="/owners/portal-invites" className="font-semibold text-accent hover:underline">Show every owner</Link>
          </p>
        )}
        {rows.length ? <PortalInviteList rows={rows} noun="owner" canSend={canSend} /> : <EmptyState title="No owners yet">Add an owner first.</EmptyState>}
      </Card>
    </>
  );
}
