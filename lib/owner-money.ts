// Money that moves between an owner and its own LLC (Wesley Owen, Nov 2, 2026; docs/02 "Owner money").
// Own-books owners keep their money in their own bank: what they take out is an owner draw, what they put in
// (or pay for the LLC from somewhere else) is an owner contribution. A mortgage payment is split so only the
// interest is an expense; the principal pays down the loan. Each kind is one balanced entry.

export type OwnerMoneyKind = "draw" | "contribution" | "paid_personally" | "loan_payment";

export const OWNER_MONEY_LABEL: Record<OwnerMoneyKind, string> = {
  draw: "Owner draw (money taken out)",
  contribution: "Owner contribution (money put in)",
  paid_personally: "Expense paid from outside the LLC's account",
  loan_payment: "Mortgage or loan payment",
};

export type OwnerMoneyInput = {
  kind: OwnerMoneyKind;
  amountCents: number;          // draw, contribution, paid_personally
  expenseAccount?: string;      // paid_personally: which expense
  interestCents?: number;       // loan_payment
  principalCents?: number;      // loan_payment
  propertyId?: string | null;
};

type Posting = { account: string; debit?: number; credit?: number; property_id?: string };

/** The entry's lines, or an error in plain words. */
export function ownerMoneyLines(i: OwnerMoneyInput): { lines?: Posting[]; error?: string } {
  const p = i.propertyId ? { property_id: i.propertyId } : {};
  if (i.kind === "loan_payment") {
    const interest = i.interestCents ?? 0;
    const principal = i.principalCents ?? 0;
    if (interest < 0 || principal < 0 || interest + principal <= 0) return { error: "Enter the interest and principal from the loan statement." };
    return {
      lines: [
        ...(interest ? [{ account: "5500", debit: interest, ...p }] : []),
        ...(principal ? [{ account: "2500", debit: principal, ...p }] : []),
        { account: "1000", credit: interest + principal, ...p },
      ],
    };
  }
  if (!(i.amountCents > 0)) return { error: "Enter the amount." };
  if (i.kind === "draw") return { lines: [{ account: "3100", debit: i.amountCents, ...p }, { account: "1000", credit: i.amountCents, ...p }] };
  if (i.kind === "contribution") return { lines: [{ account: "1000", debit: i.amountCents, ...p }, { account: "3000", credit: i.amountCents, ...p }] };
  if (!i.expenseAccount || !/^5\d{3}$/.test(i.expenseAccount)) return { error: "Choose the expense." };
  // Paid with the owner's own money: the expense is the LLC's, the cash never left its account.
  return { lines: [{ account: i.expenseAccount, debit: i.amountCents, ...p }, { account: "3000", credit: i.amountCents, ...p }] };
}
