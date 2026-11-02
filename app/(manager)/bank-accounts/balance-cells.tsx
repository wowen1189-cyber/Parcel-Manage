import { Td } from "@/components/table";
import { Pill } from "@/components/ui";
import { date, money } from "@/lib/format";

/** Bank balance, Parcel Manage's balance on the same day, and the difference. */
export function BalanceCells({ b }: { b: { asOf: string; bookCents: number; bankCents: number | null; diffCents: number | null; status: string } }) {
  return (
    <>
      <Td right className="text-[13px]">
        {b.bankCents == null ? (
          <span className="text-subtle">—</span>
        ) : (
          <>
            {money(b.bankCents)}
            <span className="block text-[12px] text-subtle">{date(b.asOf)}</span>
          </>
        )}
      </Td>
      <Td right className="text-[13px]">
        {money(b.bookCents)}
        <span className="block text-[12px] text-subtle">{date(b.asOf)}</span>
      </Td>
      <Td right>{b.status === "no_bank" ? <span className="text-[13px] text-subtle">No bank balance</span> : b.status === "match" ? <Pill tone="success">Matches</Pill> : <Pill tone="warn">{money(b.diffCents!)}</Pill>}</Td>
    </>
  );
}
