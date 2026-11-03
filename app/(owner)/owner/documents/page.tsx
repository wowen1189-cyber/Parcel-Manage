import Link from "next/link";
import { Card, CardHeader } from "@/components/ui";
import { DocumentList } from "@/components/document-list";
import { listDocuments } from "@/lib/document-files";
import { requireOwner } from "@/lib/portal";

export const metadata = { title: "Documents" };

// What the office shared with the owner: leases and renewals by default, plus anything switched on (migration 0059).
export default async function OwnerDocuments() {
  const { supabase, company, owners } = await requireOwner();
  const docs = await listDocuments(supabase, company.id, { sharedWithOwner: true }, 1000);
  const groups = owners.map((o) => ({
    owner: o,
    own: docs.filter((d) => d.entity_id === o.id && !d.property_id && !d.lease_id),
    properties: o.property.map((p) => ({ property: p, docs: docs.filter((d) => d.property_id === p.id) })),
  }));
  return (
    <div className="space-y-6">
      <p className="text-[14px] print:hidden">
        <Link href="/owner" className="font-semibold text-accent">
          ← Overview
        </Link>
      </p>
      <h1 className="text-[26px] font-extrabold">Documents</h1>
      {groups.map((g) => (
        <section key={g.owner.id} className="space-y-4">
          <h2 className="text-[20px] font-bold">{g.owner.name}</h2>
          {g.properties.map(({ property, docs: list }) => (
            <Card key={property.id} className="overflow-hidden">
              <CardHeader title={property.name} description="Leases, renewals and files shared with you." />
              <DocumentList docs={list} empty="Nothing shared for this property yet." />
            </Card>
          ))}
          {g.own.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader title="Statements, tax forms and agreements" />
              <DocumentList docs={g.own} empty="" />
            </Card>
          )}
        </section>
      ))}
    </div>
  );
}
