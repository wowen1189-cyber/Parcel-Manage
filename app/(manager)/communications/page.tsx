import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { exportLink, ListFilters, param } from "@/components/list-filters";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date } from "@/lib/format";
import { DELIVERY_LABEL, LETTERS } from "@/lib/letters";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Communications" };

export default async function CommunicationsPage({ searchParams }: PageProps<"/communications">) {
  const { supabase, company } = await requireCompany();
  const sp = await searchParams;
  const q = param(sp, "q");
  const kind = param(sp, "kind");
  let query = supabase
    .from("message")
    .select("id, subject, body, channel, delivery, legal, status, sender_name, created_at, lease_id, contact(kind, first_name, last_name, business_name)")
    .eq("company_id", company.id)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(200);
  if (kind === "legal") query = query.eq("legal", true);
  if (kind === "letters") query = query.not("template_id", "is", null);
  const { data } = await query;
  const needle = q.toLowerCase();
  const sent = (data ?? []).filter((m) => !needle || `${m.subject ?? ""} ${m.body} ${m.contact?.first_name ?? ""} ${m.contact?.last_name ?? ""} ${m.contact?.business_name ?? ""}`.toLowerCase().includes(needle));
  const groups = ["Florida notices", "Everyday letters"] as const;

  return (
    <>
      <PageHeader title="Communications" subtitle="Letters and Florida notices, filled in from the lease, signed by you, and filed on the tenant's record." />
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((g) => (
          <Card key={g}>
            <CardHeader title={g} description={g === "Florida notices" ? "Statutory wording. You review and send each one; nothing goes out on its own." : undefined} />
            <ul className="divide-y divide-line">
              {LETTERS.filter((l) => l.group === g).map((l) => (
                <li key={l.id}>
                  <Link href={`/communications/new?template=${l.id}`} className="block px-5 py-3 hover:bg-surface-muted">
                    <span className="font-semibold">{l.title}</span>
                    {l.cite && <span className="ml-2 text-[12px] text-subtle">{l.cite}</span>}
                    <span className="block text-[13px] text-subtle">{l.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Sent" description="Every letter, notice, e-mail and portal message sent from the office." />
        <ListFilters
          action="/communications"
          search={q}
          searchPlaceholder="Search subject, text or tenant"
          selects={[{ name: "kind", label: "Show", value: kind, options: [["letters", "Letters and notices"], ["legal", "Florida notices only"]] }]}
          exportHref={exportLink("/communications/export", { q, kind })}
          count={sent.length}
          noun={["message", "messages"]}
        />
        {sent.length ? (
          <Table minWidth={720}>
            <Thead>
              <Th>Sent</Th>
              <Th>To</Th>
              <Th>Subject</Th>
              <Th>How</Th>
            </Thead>
            <Tbody>
              {sent.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap text-[13px]">{date(m.created_at.slice(0, 10))}</Td>
                  <Td className="text-[13px]">{m.contact ? [m.contact.first_name, m.contact.last_name].filter(Boolean).join(" ") || m.contact.business_name : "—"}</Td>
                  <Td>
                    <RowLink href={`/communications/${m.id}`} sub={m.sender_name ?? undefined}>
                      {m.subject ?? m.body.slice(0, 60)}
                    </RowLink>
                    {m.legal && <Pill tone="warn">Legal notice</Pill>}
                    {m.status === "failed" && <Pill tone="danger">Didn&apos;t send</Pill>}
                  </Td>
                  <Td className="text-[13px]">{DELIVERY_LABEL[m.delivery ?? m.channel] ?? m.channel}</Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <EmptyState title="Nothing sent yet" />
        )}
      </Card>
    </>
  );
}
