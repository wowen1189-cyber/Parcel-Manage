import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, CardHeader, Notice, PageHeader, Pill } from "@/components/ui";
import { BILL_STATUS, EXPENSE_ACCOUNTS } from "@/lib/bills";
import { contactName, date, money, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { canPay } from "@/lib/vendor-requests";
import { voidBill } from "../actions";
import { ApproveForm, PayForm } from "../forms";

export const metadata = { title: "Bill" };

export default async function BillPage({ params, searchParams }: PageProps<"/bills/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company, membership } = await requireCompany();
  const { data: b } = await supabase
    .from("bill")
    .select("*, property(id, name), entity(name), vendor(id, w9_on_file, is_1099, contact(kind, first_name, last_name, business_name)), work_order(id, number, title), document!bill_document_id_fkey(storage_path, file_name)")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!b) notFound();
  const file = b.document ? (await createAdminClient().storage.from("documents").createSignedUrl(b.document.storage_path, 600)).data?.signedUrl : null;
  const today = todayIn(company.time_zone);
  const vendorName = b.vendor ? contactName(b.vendor.contact) : "No vendor";
  const blocked = b.vendor && !canPay(b.vendor) ? `${vendorName} can't be paid until their W-9 is on file. Send a paperwork request from their vendor page.` : null;
  const canApprove = ["admin", "property_manager", "accountant"].includes(membership.role);
  const canPayRole = ["admin", "accountant"].includes(membership.role);

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/bills" className="font-semibold text-accent hover:underline">
          ← Bills
        </Link>
      </p>
      <PageHeader title={`${vendorName} · ${money(b.amount_cents)}`} subtitle={[b.invoice_number && `Invoice ${b.invoice_number}`, b.property?.name, b.entity?.name].filter(Boolean).join(" · ")} action={<Pill tone={BILL_STATUS[b.status]?.tone ?? "neutral"}>{BILL_STATUS[b.status]?.label}</Pill>} />
      {sp.added && <Notice tone="success">Bill saved. Approve it to post the expense.</Notice>}
      <Card className="mt-4 p-5 text-[14px]">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-[12px] font-semibold text-subtle">Invoice date</dt>
            <dd>{date(b.invoice_date)}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold text-subtle">Due</dt>
            <dd>{date(b.due_date)}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold text-subtle">From</dt>
            <dd>{b.source === "vendor portal" ? "Vendor's job link" : b.source}</dd>
          </div>
          {b.work_order && (
            <div>
              <dt className="text-[12px] font-semibold text-subtle">Work order</dt>
              <dd>
                <Link href={`/maintenance/${b.work_order.id}`} className="font-semibold text-accent hover:underline">
                  #{b.work_order.number} {b.work_order.title}
                </Link>
              </dd>
            </div>
          )}
          {file && (
            <div>
              <dt className="text-[12px] font-semibold text-subtle">Invoice file</dt>
              <dd>
                <a href={file} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                  Open {b.document?.file_name}
                </a>
              </dd>
            </div>
          )}
          {b.memo && (
            <div className="sm:col-span-3">
              <dt className="text-[12px] font-semibold text-subtle">Memo</dt>
              <dd>{b.memo}</dd>
            </div>
          )}
          {b.paid_on && (
            <div>
              <dt className="text-[12px] font-semibold text-subtle">Paid</dt>
              <dd>
                {date(b.paid_on)} · {b.payment_method}
                {b.payment_reference ? ` ${b.payment_reference}` : ""}
              </dd>
            </div>
          )}
        </dl>
        {(b.journal_entry_id || b.paid_entry_id) && (
          <p className="mt-3 text-[13px]">
            {b.journal_entry_id && (
              <Link href={`/journal-entries/${b.journal_entry_id}`} className="mr-4 font-semibold text-accent hover:underline">
                Expense entry
              </Link>
            )}
            {b.paid_entry_id && (
              <Link href={`/journal-entries/${b.paid_entry_id}`} className="font-semibold text-accent hover:underline">
                Payment entry
              </Link>
            )}
          </p>
        )}
      </Card>
      {b.status === "received" && canApprove && (
        <Card className="mt-6">
          <CardHeader title="Approve" description="Check the amount and account against the invoice. Approving posts the expense and what's owed to the vendor." />
          <div className="px-5 py-4">
            <ApproveForm id={b.id} amount={(b.amount_cents / 100).toFixed(2)} account={b.expense_account} due={b.due_date ?? today} accounts={EXPENSE_ACCOUNTS} />
          </div>
        </Card>
      )}
      {b.status === "approved" && canPayRole && (
        <Card className="mt-6">
          <CardHeader title="Record payment" description="After you pay by check, ACH or card. Online vendor payments arrive with bank connections." />
          <div className="px-5 py-4">
            <PayForm id={b.id} today={today} blocked={blocked} />
          </div>
        </Card>
      )}
      {(b.status === "received" || b.status === "approved") && canApprove && (
        <form action={voidBill} className="mt-6">
          <input type="hidden" name="id" value={b.id} />
          <Button type="submit" small variant="ghost">
            Void this bill
          </Button>
        </form>
      )}
    </>
  );
}
