import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailHtml, emailText } from "@/lib/email/layout";
import { sendEmail } from "@/lib/integrations/resend/send";
import { contactName, date, money } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/ledger";
import type { Database } from "@/lib/supabase/database.types";

// Payment receipts: e-mailed to the lease's tenants whenever a payment is recorded, by the office or online.
// Never throws; a missing e-mail address or e-mail setup just means no receipt.

export async function sendReceipt(db: SupabaseClient<Database>, companyId: string, paymentId: string) {
  try {
    const { data: p } = await db
      .from("payment")
      .select("amount_cents, method, received_on, purpose, reference, lease(unit(label, property(name)), lease_tenant(role, contact(kind, first_name, last_name, business_name, email))), company(name, office_email)")
      .eq("id", paymentId)
      .eq("company_id", companyId)
      .single();
    if (!p) return false;
    const to = p.lease.lease_tenant.filter((t) => t.role === "tenant" && t.contact?.email).map((t) => t.contact!.email!);
    if (!to.length) return false;
    const where = `${p.lease.unit.property.name}, ${p.lease.unit.label}`;
    const what = p.purpose === "deposit" ? "security deposit" : "payment";
    const content = {
      preheader: `We received your ${what} of ${money(p.amount_cents)}.`,
      heading: "Payment received",
      paragraphs: [
        `Thank you, ${p.lease.lease_tenant.filter((t) => t.role === "tenant").map((t) => contactName(t.contact)).join(" and ")}. We received your ${what}.`,
        `Amount: ${money(p.amount_cents)}`,
        `Date: ${date(p.received_on)}`,
        `How: ${PAYMENT_METHODS[p.method] ?? p.method}${p.reference ? ` (${p.reference})` : ""}`,
        `For: ${where}`,
        "You can see your full ledger any time in your resident portal. Keep this e-mail as your receipt.",
      ],
      fromLine: p.company.name,
    };
    return await sendEmail({ to, subject: `Receipt: ${money(p.amount_cents)} received`, html: emailHtml(content), text: emailText(content), fromName: p.company.name, replyTo: p.company.office_email });
  } catch {
    return false;
  }
}
