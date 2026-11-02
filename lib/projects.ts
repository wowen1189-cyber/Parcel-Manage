// Project budgets: spent is bills approved or paid for the project (directly or through one of its POs);
// committed is what approved purchase orders still expect to bill; left is the budget minus both.

export const PROJECT_STATUS = { planning: "Planning", active: "Active", done: "Done", canceled: "Canceled" } as const;
export const PO_STATUS = { draft: "Waiting for approval", approved: "Approved", closed: "Closed", void: "Void" } as const;

type Po = { id: string; amount_cents: number; status: string };
type Bill = { amount_cents: number; status: string; purchase_order_id: string | null };

const counts = (b: Bill) => ["approved", "scheduled", "paid"].includes(b.status);

export function projectTotals(budgetCents: number, pos: Po[], bills: Bill[]) {
  const spent = bills.filter(counts).reduce((s, b) => s + b.amount_cents, 0);
  const committed = pos
    .filter((p) => p.status === "approved")
    .reduce((s, p) => s + Math.max(0, p.amount_cents - bills.filter((b) => counts(b) && b.purchase_order_id === p.id).reduce((t, b) => t + b.amount_cents, 0)), 0);
  return { spent, committed, left: budgetCents - spent - committed, over: spent + committed > budgetCents && budgetCents > 0 };
}

/** What's been billed against one PO, and what's left on it. */
export function poBilled(po: Po, bills: Bill[]) {
  const billed = bills.filter((b) => counts(b) && b.purchase_order_id === po.id).reduce((s, b) => s + b.amount_cents, 0);
  return { billed, left: po.amount_cents - billed };
}
