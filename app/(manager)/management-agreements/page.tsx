import Link from "next/link";
import { Button, buttonClass, Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date } from "@/lib/format";
import { AGREEMENT_STATUS as STATUS } from "@/lib/management-agreement";
import { UNASSIGNED_OWNER } from "@/lib/owners";
import { requireCompany } from "@/lib/session";
import { createAgreement } from "./actions";

export const metadata = { title: "Management agreements" };


// Every owner and their management agreement: who has a signed one, who's out for signature, who has none.
export default async function ManagementAgreementsPage() {
  const { supabase, company, membership } = await requireCompany();
  const canEdit = ["admin", "property_manager"].includes(membership.role);
  const [{ data: owners }, { data: agreements }] = await Promise.all([
    supabase.from("entity").select("id, name, property(id)").eq("company_id", company.id).eq("is_manager", false).order("name"),
    supabase.from("management_agreement").select("id, entity_id, status, start_date, end_date, property_ids, signed_at, created_at").eq("company_id", company.id).order("created_at", { ascending: false }),
  ]);
  const rows = (owners ?? [])
    .filter((o) => o.name !== UNASSIGNED_OWNER)
    .map((o) => {
      const mine = (agreements ?? []).filter((a) => a.entity_id === o.id);
      // The one that matters: signed and not ended, else the newest.
      return { owner: o, current: mine.find((a) => a.status === "signed") ?? mine[0] ?? null, count: mine.length };
    });
  const signed = rows.filter((r) => r.current?.status === "signed").length;

  return (
    <>
      <PageHeader
        title="Management agreements"
        subtitle={`${signed} of ${rows.length} owners have a signed agreement. Each one fills in from the owner, their properties and their fees, and goes to the owner for e-signature.`}
        action={
          <Link href="/management-agreements/templates" className={buttonClass("secondary")}>
            Templates
          </Link>
        }
      />
      <Card className="overflow-hidden">
        <CardHeader title="Owners" />
        {!rows.length ? (
          <EmptyState title="No owners yet">Add owners first, then start their agreements here.</EmptyState>
        ) : (
          <Table minWidth={760}>
            <Thead>
              <Th>Owner</Th>
              <Th>Agreement</Th>
              <Th>Term</Th>
              <Th right>Properties</Th>
              <Th />
            </Thead>
            <Tbody>
              {rows.map(({ owner, current }) => (
                <tr key={owner.id}>
                  <Td>
                    <RowLink href={`/owners/${owner.id}`}>{owner.name}</RowLink>
                  </Td>
                  <Td>{current ? <Pill tone={STATUS[current.status].tone}>{STATUS[current.status].label}</Pill> : <Pill tone="warn">None</Pill>}</Td>
                  <Td className="text-[13px]">{current ? `${date(current.start_date)} – ${date(current.end_date)}` : <span className="text-subtle">—</span>}</Td>
                  <Td right>{current ? `${current.property_ids.length} of ${owner.property.length}` : owner.property.length}</Td>
                  <Td right>
                    {current && current.status !== "ended" ? (
                      <Link href={`/management-agreements/${current.id}`} className="font-semibold text-accent hover:underline">
                        Open
                      </Link>
                    ) : canEdit ? (
                      <form action={createAgreement}>
                        <input type="hidden" name="entity_id" value={owner.id} />
                        <Button type="submit" small variant="secondary">
                          Start agreement
                        </Button>
                      </form>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
