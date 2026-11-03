import { Card, CardHeader, Notice } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date, money } from "@/lib/format";
import type { DetailItem, StatementDetail } from "@/lib/owner-statement-detail";

// The itemized part of an owner statement: how cash moved this month, then every income and expense line by
// property. Used on the manager's statement page and in the owner portal.

function Items({ title, items, totalCents }: { title: string; items: DetailItem[]; totalCents: number }) {
  return (
    <>
      <tr className="bg-surface-muted">
        <Td className="font-semibold" colSpan={3}>
          {title}
        </Td>
      </tr>
      {items.length ? (
        items.map((i, n) => (
          <tr key={n}>
            <Td className="whitespace-nowrap">{date(i.date)}</Td>
            <Td>
              {i.description}
              <span className="block text-[12px] text-subtle">
                {i.account}
                {i.unit ? ` · ${i.unit}` : ""}
              </span>
            </Td>
            <Td right className="whitespace-nowrap">
              {money(i.amountCents)}
            </Td>
          </tr>
        ))
      ) : (
        <tr>
          <Td colSpan={3} className="text-subtle">
            None
          </Td>
        </tr>
      )}
      <tr>
        <Td colSpan={2} className="font-semibold">
          Total {title.toLowerCase()}
        </Td>
        <Td right className="font-semibold">
          {money(totalCents)}
        </Td>
      </tr>
    </>
  );
}

export function StatementDetailView({ detail }: { detail: StatementDetail }) {
  const c = detail.cash;
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader title="Where the cash went" description="Beginning cash, money in and out of the operating account, and ending cash." />
        <Table minWidth={320}>
          <Thead>
            <Th>Item</Th>
            <Th right>In</Th>
            <Th right>Out</Th>
          </Thead>
          <Tbody>
            <tr>
              <Td className="font-semibold">Beginning cash</Td>
              <Td right className="font-semibold" colSpan={2}>
                {money(c.beginningCents)}
              </Td>
            </tr>
            {c.rows.map((r) => (
              <tr key={r.kind}>
                <Td>{r.label}</Td>
                <Td right>{r.inCents ? money(r.inCents) : ""}</Td>
                <Td right>{r.outCents ? money(r.outCents) : ""}</Td>
              </tr>
            ))}
            <tr>
              <Td>Total</Td>
              <Td right>{money(c.inCents)}</Td>
              <Td right>{money(c.outCents)}</Td>
            </tr>
            <tr>
              <Td className="font-semibold">Ending cash</Td>
              <Td right className="font-semibold" colSpan={2}>
                {money(c.endingCents)}
              </Td>
            </tr>
          </Tbody>
        </Table>
        {!c.tiesToBooks && (
          <div className="px-5 pb-4">
            <Notice tone="warn">Beginning cash plus money in, less money out, doesn&apos;t equal ending cash. An entry may be missing a cash line; ask your accountant.</Notice>
          </div>
        )}
      </Card>
      {detail.groups.map((g) => (
        <Card key={g.propertyId ?? "none"} className="overflow-hidden">
          <CardHeader title={g.name} description={`Income ${money(g.incomeCents)} · expenses ${money(g.expensesCents)} · net ${money(g.netCents)}`} />
          <Table minWidth={320}>
            <Thead>
              <Th>Date</Th>
              <Th>Description</Th>
              <Th right>Amount</Th>
            </Thead>
            <Tbody>
              <Items title="Income" items={g.income} totalCents={g.incomeCents} />
              <Items title="Expenses" items={g.expenses} totalCents={g.expensesCents} />
            </Tbody>
          </Table>
        </Card>
      ))}
    </div>
  );
}
