import Link from "next/link";
import { buttonClass, Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { exportLink, ListFilters, param } from "@/components/list-filters";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { listVendors, PAPERWORK_OPTIONS } from "@/lib/vendor-list";
import { PAYMENT_METHOD_LABEL, VENDOR_TRADES } from "@/lib/vendors";
import { PaperworkPill } from "./paperwork-pill";

export const metadata = { title: "Vendors" };

export default async function VendorsPage({ searchParams }: PageProps<"/vendors">) {
  const { supabase, company } = await requireCompany();
  const params = await searchParams;
  const filters = { q: param(params, "q"), trade: param(params, "trade"), paperwork: param(params, "paperwork") };
  const vendors = await listVendors(supabase, company.id, filters, todayIn(company.time_zone));

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle="Who you call, and whether their W-9 and insurance are on file."
        action={
          <Link href="/vendors/new" className={buttonClass("primary", true)}>
            + New vendor
          </Link>
        }
      />
      <Card className="overflow-hidden">
        <ListFilters
          action="/vendors"
          search={filters.q}
          searchPlaceholder="Search by name, trade, phone or email"
          selects={[
            { name: "trade", label: "Trade", value: filters.trade, options: VENDOR_TRADES.map((t) => [t, t]) },
            { name: "paperwork", label: "Paperwork", value: filters.paperwork, options: PAPERWORK_OPTIONS },
          ]}
          exportHref={exportLink("/vendors/export", filters)}
          count={vendors.length}
          noun={["vendor", "vendors"]}
        />
        {!vendors.length ? (
          <EmptyState title="No vendors match">Try a different search or clear the filters.</EmptyState>
        ) : (
          <Table minWidth={900}>
            <Thead>
              <Th>Vendor</Th>
              <Th>Trade</Th>
              <Th>Contact</Th>
              <Th>Paperwork</Th>
              <Th>Pay by</Th>
              <Th>Last paid</Th>
            </Thead>
            <Tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <Td>
                    <RowLink href={`/vendors/${v.id}`} sub={v.contact.notes?.startsWith("Contact: ") ? v.contact.notes.split("\n")[0] : undefined}>
                      {v.name}
                    </RowLink>
                  </Td>
                  <Td>{v.trade ?? "—"}</Td>
                  <Td className="text-[13px]">
                    {v.phoneDisplay && <p>{v.phoneDisplay}</p>}
                    {v.contact.email && <p className="text-subtle">{v.contact.email}</p>}
                  </Td>
                  <Td>
                    <PaperworkPill compliance={v.compliance} />
                  </Td>
                  <Td className="text-[13px]">
                    {v.payment_method ? PAYMENT_METHOD_LABEL[v.payment_method] : "—"}
                    {v.is_1099 && <p className="text-subtle">1099</p>}
                  </Td>
                  <Td className="text-[13px]">{date(v.last_paid_on)}</Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        )}
        <p className="border-t border-line px-5 py-3 text-[13px] text-subtle">
          Vendors who work on site need a W-9 and current insurance before a work order can be sent to them. Utilities, suppliers and
          professionals are exempt. <Pill tone="danger">Can&apos;t dispatch</Pill> means something is missing or expired.
        </p>
      </Card>
    </>
  );
}
