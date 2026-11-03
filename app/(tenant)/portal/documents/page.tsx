import { Card, CardHeader } from "@/components/ui";
import { DocumentList } from "@/components/document-list";
import { listDocuments } from "@/lib/document-files";
import { requireTenant } from "@/lib/portal";

export const metadata = { title: "Documents" };

// The tenant's lease (and renewals) plus anything else the office chose to share (migration 0059).
export default async function PortalDocuments() {
  const { supabase, company, leases } = await requireTenant();
  const docs = await listDocuments(supabase, company.id, { leaseIds: leases.map((l) => l.id), sharedWithTenant: true });
  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold">Documents</h1>
      <Card className="overflow-hidden">
        <CardHeader title="Your documents" description="Your signed lease and renewals, and anything else the office shares with you." />
        <DocumentList docs={docs} empty="Your signed lease will show here." />
      </Card>
    </div>
  );
}
